// 保留原生WAL恢复语义；错误不回传SQL、正文或绝对路径。
#include "core/storage/sqlite/store.hpp"
#include "contracts.hpp"
namespace gg {
void sql_check(int rc) {
    if (rc == SQLITE_OK || rc == SQLITE_ROW || rc == SQLITE_DONE) return;
    switch (rc & 255) {
        case SQLITE_FULL: throw Error("STORAGE_FULL");
        case SQLITE_CORRUPT: case SQLITE_NOTADB: throw Error("DATABASE_CORRUPT");
        case SQLITE_BUSY: case SQLITE_LOCKED: throw Error("PROJECT_BUSY");
        case SQLITE_READONLY: case SQLITE_PERM: case SQLITE_AUTH: throw Error("PERMISSION_DENIED");
        default: throw Error("IO_ERROR");
    }
}
Statement::Statement(sqlite3* db, const char* sql, const std::vector<Json>& args) {
    const auto rc = sqlite3_prepare_v2(db, sql, -1, &stmt_, nullptr);
    if (rc != SQLITE_OK) { if (stmt_) sqlite3_finalize(stmt_); stmt_ = nullptr; sql_check(rc); }
    try {
        for (std::size_t i = 0; i < args.size(); ++i) {
            const auto& v = args[i]; const int index = static_cast<int>(i + 1);
            if (v.is_null()) sql_check(sqlite3_bind_null(stmt_, index));
            else if (v.is_number_integer()) sql_check(sqlite3_bind_int64(stmt_, index, v.get<std::int64_t>()));
            else if (v.is_boolean()) sql_check(sqlite3_bind_int(stmt_, index, v.get<bool>() ? 1 : 0));
            else { const auto s = text(v); sql_check(sqlite3_bind_text(stmt_, index, s.data(), static_cast<int>(s.size()), SQLITE_TRANSIENT)); }
        }
    } catch (...) { sqlite3_finalize(stmt_); stmt_ = nullptr; throw; }
}
Statement::~Statement() { if (stmt_) sqlite3_finalize(stmt_); }
bool Statement::next() { const int rc = sqlite3_step(stmt_); sql_check(rc); return rc == SQLITE_ROW; }
Row Statement::row() const {
    Row r;
    for (int i = 0; i < sqlite3_column_count(stmt_); ++i) {
        switch (sqlite3_column_type(stmt_, i)) {
            case SQLITE_NULL: r.emplace_back(nullptr); break;
            case SQLITE_INTEGER: r.emplace_back(sqlite3_column_int64(stmt_, i)); break;
            case SQLITE_FLOAT: r.emplace_back(sqlite3_column_double(stmt_, i)); break;
            case SQLITE_BLOB: {
                const auto* b = static_cast<const char*>(sqlite3_column_blob(stmt_, i));
                r.emplace_back(std::string(b ? b : "", sqlite3_column_bytes(stmt_, i))); break;
            }
            default: {
                const auto* t = reinterpret_cast<const char*>(sqlite3_column_text(stmt_, i));
                r.emplace_back(std::string(t ? t : "", sqlite3_column_bytes(stmt_, i))); break;
            }
        }
    }
    return r;
}
void Statement::blob(int index, std::string_view data) {
    sql_check(sqlite3_bind_blob(stmt_, index, data.data(), static_cast<int>(data.size()), SQLITE_TRANSIENT));
}
Store::~Store() { close(); }
void Store::open(const std::string& path, bool create, bool read_only) {
    require(!db_, "PROJECT_BUSY");
    const int flags = SQLITE_OPEN_FULLMUTEX | (read_only ? SQLITE_OPEN_READONLY : SQLITE_OPEN_READWRITE) |
                      (create ? SQLITE_OPEN_CREATE : 0);
    const auto rc = sqlite3_open_v2(path.c_str(), &db_, flags, nullptr);
    if (rc != SQLITE_OK) { close(); sql_check(rc); }
    try {
        sqlite3_extended_result_codes(db_, 1);
        sql_check(sqlite3_db_config(db_, SQLITE_DBCONFIG_DEFENSIVE, 1, nullptr));
        sql_check(sqlite3_db_config(db_, SQLITE_DBCONFIG_TRUSTED_SCHEMA, 0, nullptr));
        sqlite3_limit(db_, SQLITE_LIMIT_LENGTH, 4194304);
        sqlite3_limit(db_, SQLITE_LIMIT_SQL_LENGTH, 131072);
        sqlite3_limit(db_, SQLITE_LIMIT_VARIABLE_NUMBER, 128);
        sqlite3_busy_timeout(db_, 1000);
        exec("PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF");
        if (!create) verify_structure();
        if (!read_only && path != ":memory:") {
            require(scalar("PRAGMA journal_mode=WAL") == "wal", "IO_ERROR");
            exec("PRAGMA synchronous=FULL; PRAGMA wal_autocheckpoint=1000");
        }
    } catch (...) { close(); throw; }
}
void Store::close() { if (db_) { sqlite3_close_v2(db_); db_ = nullptr; } }
void Store::exec(const char* sql) { sql_check(sqlite3_exec(db_, sql, nullptr, nullptr, nullptr)); }
std::vector<Row> Store::query(const char* sql, const std::vector<Json>& args) {
    Statement q(db_, sql, args); std::vector<Row> result;
    while (q.next()) result.push_back(q.row());
    return result;
}
void Store::run(const char* sql, const std::vector<Json>& args) { Statement q(db_, sql, args); while (q.next()) {} }
Json Store::scalar(const char* sql, const std::vector<Json>& args) {
    auto rows = query(sql, args); require(!rows.empty() && !rows.front().empty(), "NOT_FOUND"); return rows.front().front();
}
void Store::verify_structure() {
    require(scalar("PRAGMA application_id") == 1195853134, "UNSUPPORTED_FORMAT");
    const auto v = scalar("PRAGMA user_version").get<int>();
    require(v <= 1, "UNSUPPORTED_FORMAT"); require(v == 1, "MIGRATION_REQUIRED");
    // 从内置DDL构建预期结构，拒绝额外触发器/视图，避免执行项目自带SQL。
    Store expected; expected.open(":memory:", true, false); expected.exec(ddl);
    const char* schema = "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name";
    require(query(schema) == expected.query(schema), "UNSUPPORTED_SCHEMA");
    require(scalar("PRAGMA quick_check") == "ok", "DATABASE_CORRUPT");
    require(query("PRAGMA foreign_key_check").empty(), "DATABASE_CORRUPT");
}
void Store::backup(const std::string& destination, const std::function<void()>& checkpoint) {
    sqlite3* target = nullptr;
    int rc = sqlite3_open_v2(destination.c_str(), &target, SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nullptr);
    if (rc != SQLITE_OK) { if (target) sqlite3_close(target); sql_check(rc); }
    sqlite3_backup* copy = sqlite3_backup_init(target, "main", db_, "main");
    if (!copy) { const int error = sqlite3_errcode(target); sqlite3_close(target); sql_check(error); }
    try {
        do { checkpoint(); rc = sqlite3_backup_step(copy, 64); sql_check(rc); } while (rc == SQLITE_OK);
        const int finished = sqlite3_backup_finish(copy); copy = nullptr; sql_check(finished);
        sql_check(sqlite3_close(target)); target = nullptr;
        Store check; check.open(destination, false, true);
    } catch (...) { if (copy) sqlite3_backup_finish(copy); if (target) sqlite3_close(target); throw; }
}
}
