// 持有目录句柄限制重命名；本库不声称能隔离同用户恶意本机代码。
#include "platform/platform.hpp"
#include <array>
#include <fstream>
#include <mutex>
#include <regex>
#include <set>
#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#else
#include <cerrno>
#include <fcntl.h>
#include <sys/file.h>
#include <sys/syscall.h>
#include <sys/stat.h>
#include <sys/statvfs.h>
#include <unistd.h>
#endif
namespace gg {
namespace {
std::mutex locks_mutex;
std::set<std::string> process_locks;
std::filesystem::path native_path(const std::string& s) { return std::filesystem::u8path(s); }
std::string utf8_path(const std::filesystem::path& p) {
    const auto u = p.u8string(); return std::string(reinterpret_cast<const char*>(u.data()), u.size());
}
void safe_name(const std::string& name, const char* pattern) {
    require(std::regex_match(name, std::regex(pattern)), "INVALID_PATH");
}
}
struct Directory {
    std::filesystem::path path;
#ifdef _WIN32
    HANDLE handle = INVALID_HANDLE_VALUE;
    explicit Directory(const std::filesystem::path& p) : path(p) {
        handle = CreateFileW(p.c_str(), FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr,
                             OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
        require(handle != INVALID_HANDLE_VALUE, "PERMISSION_DENIED");
        BY_HANDLE_FILE_INFORMATION info{};
        if (!GetFileInformationByHandle(handle, &info) ||
            !(info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || (info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)) {
            CloseHandle(handle); handle = INVALID_HANDLE_VALUE; throw Error("INVALID_PATH");
        }
    }
    ~Directory() { if (handle != INVALID_HANDLE_VALUE) CloseHandle(handle); }
#else
    int fd = -1;
    Directory(const std::filesystem::path& p, int parent = AT_FDCWD, const char* child = nullptr) : path(p) {
        fd = openat(parent, child ? child : p.c_str(), O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
        require(fd >= 0, "PERMISSION_DENIED");
    }
    ~Directory() { if (fd >= 0) ::close(fd); }
#endif
    void verify() const {
#ifdef _WIN32
        BY_HANDLE_FILE_INFORMATION a{}, b{};
        HANDLE current = CreateFileW(path.c_str(), FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr,
                                    OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
        require(current != INVALID_HANDLE_VALUE, "PERMISSION_DENIED");
        const bool same = GetFileInformationByHandle(handle, &a) && GetFileInformationByHandle(current, &b) &&
            !(b.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) && a.dwVolumeSerialNumber == b.dwVolumeSerialNumber &&
            a.nFileIndexHigh == b.nFileIndexHigh && a.nFileIndexLow == b.nFileIndexLow;
        CloseHandle(current); require(same, "INVALID_PATH");
#else
        struct stat original{}, current{};
        require(fstat(fd, &original) == 0 && lstat(path.c_str(), &current) == 0 &&
            S_ISDIR(current.st_mode) && original.st_dev == current.st_dev && original.st_ino == current.st_ino, "INVALID_PATH");
#endif
    }
    void verify_file(const std::string& name) const {
#ifdef _WIN32
        const auto p = path / native_path(name);
        const auto attr = GetFileAttributesW(p.c_str());
        if (attr != INVALID_FILE_ATTRIBUTES)
            require(!(attr & (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_DIRECTORY)), "INVALID_PATH");
#else
        struct stat s{};
        if (fstatat(fd, name.c_str(), &s, AT_SYMLINK_NOFOLLOW) == 0)
            require(S_ISREG(s.st_mode) && s.st_nlink == 1, "INVALID_PATH");
        else require(errno == ENOENT, "PERMISSION_DENIED");
#endif
    }
    std::string child_path(const std::string& name) const {
#ifdef _WIN32
        return utf8_path(path / native_path(name));
#else
        // 保留目录fd使SQLite及其WAL文件落在已授权目录内。
        return "/proc/self/fd/" + std::to_string(fd) + "/" + name;
#endif
    }
};
namespace {
struct ExclusiveLock {
    std::string identity;
#ifdef _WIN32
    HANDLE file = INVALID_HANDLE_VALUE;
#else
    int fd = -1;
#endif
    explicit ExclusiveLock(const std::shared_ptr<Directory>& dir) {
        dir->verify_file(".gglock");
#ifdef _WIN32
        BY_HANDLE_FILE_INFORMATION info{};
        require(GetFileInformationByHandle(dir->handle, &info), "PERMISSION_DENIED");
        identity = std::to_string(info.dwVolumeSerialNumber) + ":" + std::to_string(info.nFileIndexHigh) +
                   ":" + std::to_string(info.nFileIndexLow);
#else
        struct stat info{};
        require(fstat(dir->fd, &info) == 0, "PERMISSION_DENIED");
        identity = std::to_string(info.st_dev) + ":" + std::to_string(info.st_ino);
#endif
        std::lock_guard guard(locks_mutex);
        require(!process_locks.contains(identity), "PROJECT_BUSY");
#ifdef _WIN32
        const auto p = dir->path / L".gglock";
        file = CreateFileW(p.c_str(), GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr,
                           OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
        require(file != INVALID_HANDLE_VALUE, "PERMISSION_DENIED");
        OVERLAPPED ov{};
        if (!LockFileEx(file, LOCKFILE_EXCLUSIVE_LOCK | LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, &ov)) {
            CloseHandle(file); file = INVALID_HANDLE_VALUE; throw Error("PROJECT_BUSY");
        }
#else
        fd = openat(dir->fd, ".gglock", O_RDWR | O_CREAT | O_CLOEXEC | O_NOFOLLOW, 0600);
        require(fd >= 0, "PERMISSION_DENIED");
        if (flock(fd, LOCK_EX | LOCK_NB) != 0) { ::close(fd); fd = -1; throw Error("PROJECT_BUSY"); }
#endif
        process_locks.insert(identity);
    }
    ~ExclusiveLock() {
        std::lock_guard guard(locks_mutex);
#ifdef _WIN32
        if (file != INVALID_HANDLE_VALUE) CloseHandle(file);
#else
        if (fd >= 0) ::close(fd);
#endif
        process_locks.erase(identity);
    }
};
}
RootGrant::RootGrant(const std::string& root) {
    auto p = native_path(root);
    require(p.is_absolute(), "INVALID_PATH");
    p = p.lexically_normal();
    require(std::filesystem::canonical(p) == p, "INVALID_PATH");
    for (auto part = p; !part.empty(); part = part.parent_path()) {
        require(!std::filesystem::is_symlink(std::filesystem::symlink_status(part)), "INVALID_PATH");
#ifdef _WIN32
        const auto attr = GetFileAttributesW(part.c_str());
        require(attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_REPARSE_POINT), "INVALID_PATH");
#endif
        if (part == part.parent_path()) break;
    }
#ifdef _WIN32
    require(GetDriveTypeW(p.root_path().c_str()) == DRIVE_FIXED, "INVALID_PATH");
#endif
    directory_ = std::make_shared<Directory>(p);
}
std::unique_ptr<ProjectLocation> RootGrant::project(const std::string& name, bool create, bool writable) {
    safe_name(name, "^[a-zA-Z0-9_-]{1,64}\\.ggproject$");
    directory_->verify();
    const auto target = directory_->path / native_path(name);
#ifdef _WIN32
    if (create) require(CreateDirectoryW(target.c_str(), nullptr), "ALREADY_EXISTS");
    auto child = std::make_shared<Directory>(target);
#else
    if (create) require(mkdirat(directory_->fd, name.c_str(), 0700) == 0, "ALREADY_EXISTS");
    auto child = std::make_shared<Directory>(target, directory_->fd, name.c_str());
#endif
    return std::make_unique<ProjectLocation>(std::move(child), writable);
}
ProjectLocation::ProjectLocation(std::shared_ptr<Directory> d, bool writable) : directory_(std::move(d)) {
    verify();
    if (writable) lock_ = std::make_shared<ExclusiveLock>(directory_);
    database = directory_->child_path("project.sqlite");
}
ProjectLocation::~ProjectLocation() = default;
void ProjectLocation::verify() const {
    directory_->verify();
    for (const char* f : {"project.sqlite", "project.sqlite-wal", "project.sqlite-shm"}) directory_->verify_file(f);
}
std::uintmax_t ProjectLocation::available() const {
#ifdef _WIN32
    ULARGE_INTEGER free{};
    require(GetDiskFreeSpaceExW(directory_->path.c_str(), &free, nullptr, nullptr), "IO_ERROR");
    return free.QuadPart;
#else
    struct statvfs s{};
    require(fstatvfs(directory_->fd, &s) == 0, "IO_ERROR");
    return static_cast<std::uintmax_t>(s.f_bavail) * s.f_frsize;
#endif
}
RootGrant::BackupFile RootGrant::new_backup(const std::string& name) {
    safe_name(name, "^[a-zA-Z0-9_-]{1,64}\\.sqlite$");
    directory_->verify();
    const auto p = directory_->path / "backups";
#ifdef _WIN32
    if (!CreateDirectoryW(p.c_str(), nullptr)) require(GetLastError() == ERROR_ALREADY_EXISTS, "PERMISSION_DENIED");
    auto dir = std::make_shared<Directory>(p);
    HANDLE f = CreateFileW((p / native_path(name)).c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW,
                           FILE_ATTRIBUTE_NORMAL, nullptr);
    require(f != INVALID_HANDLE_VALUE, "ALREADY_EXISTS"); CloseHandle(f);
#else
    if (mkdirat(directory_->fd, "backups", 0700) != 0) require(errno == EEXIST, "PERMISSION_DENIED");
    auto dir = std::make_shared<Directory>(p, directory_->fd, "backups");
    const int fd = openat(dir->fd, name.c_str(), O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
    require(fd >= 0, "ALREADY_EXISTS"); ::close(fd);
#endif
    return {dir, dir->child_path(name), "backups/" + name};
}
RootGrant::BackupFile RootGrant::existing_backup(const std::string& relative) {
    require(relative.starts_with("backups/"),"INVALID_PATH");
    const auto name=relative.substr(8);
    safe_name(name,"^[a-zA-Z0-9_-]{1,64}\\.sqlite$");
    directory_->verify();
    const auto p=directory_->path/"backups";
#ifdef _WIN32
    auto dir=std::make_shared<Directory>(p);
#else
    auto dir=std::make_shared<Directory>(p,directory_->fd,"backups");
#endif
    dir->verify_file(name);
    require(std::filesystem::is_regular_file(std::filesystem::u8path(dir->child_path(name))),"NOT_FOUND");
    return {dir,dir->child_path(name),relative};
}
std::string random_uuid() {
    std::array<unsigned char, 16> b{};
#ifdef _WIN32
    require(BCryptGenRandom(nullptr, b.data(), static_cast<ULONG>(b.size()), BCRYPT_USE_SYSTEM_PREFERRED_RNG) == 0,
            "RNG_UNAVAILABLE");
#else
    std::size_t n = 0;
    while (n < b.size()) {
        const auto read = syscall(__NR_getrandom, b.data() + n, b.size() - n, 0);
        if (read < 0 && errno == EINTR) continue;
        require(read > 0, "RNG_UNAVAILABLE"); n += static_cast<std::size_t>(read);
    }
#endif
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    constexpr char digits[] = "0123456789abcdef";
    std::string s;
    for (std::size_t i = 0; i < b.size(); ++i) {
        if (i == 4 || i == 6 || i == 8 || i == 10) s += '-';
        s += digits[b[i] >> 4]; s += digits[b[i] & 15];
    }
    return s;
}
std::string file_hash(const std::string& path, const std::function<void()>& checkpoint) {
    std::ifstream input(native_path(path), std::ios::binary); require(input.good(), "IO_ERROR");
    Hasher digest; std::array<char, 1048576> block{};
    while (input) { checkpoint(); input.read(block.data(), block.size()); digest.update({block.data(), static_cast<std::size_t>(input.gcount())}); }
    require(input.eof(), "IO_ERROR"); return digest.finish();
}
}
