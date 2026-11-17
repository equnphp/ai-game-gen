// 平台端口仅负责授权目录、独占锁、空间与系统随机数，不含领域规则。
#pragma once
#include "core/schema/value.hpp"
#include <filesystem>
#include <memory>
namespace gg {
struct Directory;
class ProjectLocation {
    std::shared_ptr<Directory> directory_;
    std::shared_ptr<void> lock_;
public:
    std::string database;
    ProjectLocation(std::shared_ptr<Directory> directory, bool writable);
    ~ProjectLocation();
    void verify() const;
    std::uintmax_t available() const;
};
class RootGrant {
    std::shared_ptr<Directory> directory_;
public:
    explicit RootGrant(const std::string& root);
    std::unique_ptr<ProjectLocation> project(const std::string& name, bool create, bool writable);
    struct BackupFile {
        std::shared_ptr<Directory> parent;
        std::string path;
        std::string relative;
    };
    BackupFile new_backup(const std::string& name);
    BackupFile existing_backup(const std::string& relative);
};
std::string file_hash(const std::string& path, const std::function<void()>& checkpoint);
}
