// SQLite连接仅属于Core执行线程；固定SQL通过参数绑定接收业务值。
#pragma once
#include "core/schema/value.hpp"
#include <sqlite3.h>
namespace gg {
using Row = std::vector<Json>;
class Statement {
    sqlite3_stmt* stmt_ = nullptr;
public:
    Statement(sqlite3* db, const char* sql, const std::vector<Json>& args);
    ~Statement();
    Statement(const Statement&) = delete;
    Statement& operator=(const Statement&) = delete;
    bool next();
    Row row() const;
    void blob(int index, std::string_view data);
};
class Store {
    sqlite3* db_ = nullptr;
public:
    ~Store();
    Store() = default;
    Store(const Store&) = delete;
    Store& operator=(const Store&) = delete;
    void open(const std::string& path, bool create, bool read_only);
    void close();
    sqlite3* handle() const { return db_; }
    void exec(const char* sql);
    std::vector<Row> query(const char* sql, const std::vector<Json>& args = {});
    void run(const char* sql, const std::vector<Json>& args = {});
    Json scalar(const char* sql, const std::vector<Json>& args = {});
    void verify_structure();
    void backup(const std::string& destination, const std::function<void()>& checkpoint);
};
class Transaction {
    Store& store_;
    bool done_ = false;
public:
    explicit Transaction(Store& s) : store_(s) { store_.exec("BEGIN IMMEDIATE"); }
    ~Transaction() { if (!done_) { try { store_.exec("ROLLBACK"); } catch (...) {} } }
    void commit() { store_.exec("COMMIT"); done_ = true; }
};
void sql_check(int status);
}
