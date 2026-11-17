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
    // 维护锁与作者写锁独立；共享读不阻塞普通编辑，但阻止GC/移动删除。
    std::shared_ptr<void> maintenance_fence(bool exclusive) const;
};
class RootGrant {
    std::shared_ptr<Directory> directory_;
public:
    explicit RootGrant(const std::string& root);
    std::unique_ptr<ProjectLocation> project(const std::string& name, bool create, bool writable);
    // 仅native认证会话传入工程根；独立只读仓储不取得作者独占写锁。
    std::unique_ptr<ProjectLocation> current_project_read_only();
    struct BackupFile {
        std::shared_ptr<Directory> parent;
        std::string path;
        std::string relative;
    };
    BackupFile new_backup(const std::string& name);
    BackupFile existing_backup(const std::string& relative);
};
class ArtifactOutput {
    class Impl;
    std::unique_ptr<Impl> impl_;
public:
    ArtifactOutput(const std::string& private_root,const std::string& artifact_id);
    ~ArtifactOutput();
    void block(const std::string& content_hash,std::string_view bytes);
    // ready标记是发布点；其后析构保留产物，之前只清理本实例记录的文件。
    void publish(std::string_view manifest);
    std::uint64_t bytes()const;
};
std::string file_hash(const std::string& path, const std::function<void()>& checkpoint);
}
