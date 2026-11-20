// 注册表只保存已由包仓库验证的声明；本切片不安装、加载或运行插件。
#![allow(dead_code)]

use crate::wire::{id, need, Fault, Result};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::{Arc, Mutex},
};

#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub(crate) struct PackageRef {
    pub plugin_id: String,
    pub version: String,
    pub package_hash: String,
    pub publisher_key_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub(crate) struct ContributionKey {
    pub package: PackageRef,
    pub kind: String,
    pub id: String,
}

#[derive(Clone)]
pub(crate) struct Contribution {
    pub key: ContributionKey,
    pub routes: Vec<String>,
    // 声明只供宿主解释；不把其中的脚本或路径当成执行入口。
    pub declaration: Value,
}

#[derive(Clone)]
pub(crate) struct VerifiedPackage {
    pub identity: PackageRef,
    pub manifest: Value,
    pub dependencies: Vec<PackageRef>,
    pub contributions: Vec<Contribution>,
    // 此标志仅供受信发行索引适配器使用，外部 manifest 无权指定。
    pub from_distribution: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Availability {
    MissingPackage,
    HashMismatch,
    SignatureUntrusted,
    Disabled,
    PlatformUnavailable,
    IsolationUnavailable,
    DependencyMissing,
    DependencyConflict,
    DependencyCycle,
    ContributionConflict,
    ContextRequired,
    PermissionRequired,
    Available,
}

#[derive(Clone)]
pub(crate) struct Entry {
    pub contribution: Contribution,
    pub availability: Availability,
}

pub(crate) enum Selection<'a> {
    Exact(&'a ContributionKey),
    Plugin { plugin_id: &'a str, kind: &'a str, id: &'a str },
    Route { kind: &'a str, route_id: &'a str },
}

// projectPinned 由调用者提供已绑定快照的精确 pin，不能用设备默认代替。
pub(crate) enum Context<'a> {
    Legacy,
    Device,
    ProjectPinned(&'a BTreeMap<String, PackageRef>),
}

#[derive(Clone)]
struct State {
    revision: u64,
    packages: BTreeMap<(String, String), VerifiedPackage>,
    active: BTreeMap<String, PackageRef>,
    executable: BTreeSet<PackageRef>,
    contributions: BTreeMap<ContributionKey, Contribution>,
    by_kind: BTreeMap<String, BTreeSet<ContributionKey>>,
    by_route: BTreeMap<(String, String), BTreeSet<ContributionKey>>,
    trusted: BTreeMap<String, String>,
    reserved_plugins: BTreeSet<String>,
    reserved_routes: BTreeMap<(String, String), String>,
}

impl Default for State {
    fn default() -> Self {
        // 只保留身份，不表示这些官方组件已经安装或具备运行能力。
        let official = [
            ("export.target", "h5-v1", "gamegen.packager.h5-v1"),
            ("export.target", "apk-webview-v1", "gamegen.packager.apk-webview-v1"),
            ("export.target", "wechat-v1", "gamegen.packager.wechat-v1"),
            ("export.target", "douyin-v1", "gamegen.packager.douyin-v1"),
            ("project.writer", "cocos-creator-3.8", "gamegen.writer.cocos-creator-3.8"),
            ("project.writer", "layaair-3.3", "gamegen.writer.layaair-3.3"),
            ("project.writer", "godot-4.5", "gamegen.writer.godot-4.5"),
            ("tool.adapter", "gamegen.service.localagent1", "gamegen.service.localagent1"),
            ("tool.adapter", "gamegen.service.api1", "gamegen.service.api1"),
            ("tool.adapter", "gamegen.service.lan1", "gamegen.service.lan1"),
            ("tool.adapter", "gamegen.service.reader1", "gamegen.service.reader1"),
            ("tool.adapter", "gamegen.service.components1", "gamegen.service.components1"),
            ("tool.adapter", "gamegen.service.credentials1", "gamegen.service.credentials1"),
        ];
        Self {
            revision: 0, packages: BTreeMap::new(), active: BTreeMap::new(), executable: BTreeSet::new(),
            contributions: BTreeMap::new(), by_kind: BTreeMap::new(), by_route: BTreeMap::new(), trusted: BTreeMap::new(),
            reserved_plugins: official.iter().map(|(_,_,id)| (*id).to_owned()).collect(),
            reserved_routes: official.iter().map(|(kind,route,id)| (((*kind).to_owned(),(*route).to_owned()),(*id).to_owned())).collect(),
        }
    }
}

#[derive(Clone)]
pub(crate) struct RegistrySnapshot {
    pub generation: String,
    pub revision: String,
    state: Arc<State>,
}

pub(crate) struct Registry {
    generation: String,
    state: Mutex<Arc<State>>,
}

impl Registry {
    pub(crate) fn new() -> Self {
        Self { generation: id(), state: Mutex::new(Arc::new(State::default())) }
    }

    pub(crate) fn snapshot(&self) -> Result<RegistrySnapshot> {
        let state = self.state.lock().map_err(|_| Fault::new("INTERNAL_ERROR"))?.clone();
        Ok(RegistrySnapshot { generation: self.generation.clone(), revision: state.revision.to_string(), state })
    }

    // 写入整份新快照；失败不会发布部分索引，也不会消耗 revision。
    fn change<T>(&self, f: impl FnOnce(&mut State) -> Result<Option<T>>) -> Result<Option<T>> {
        let mut current = self.state.lock().map_err(|_| Fault::new("INTERNAL_ERROR"))?;
        let mut next = (**current).clone();
        let value = f(&mut next)?;
        if value.is_some() {
            next.revision = next.revision.checked_add(1).filter(|n| *n <= i64::MAX as u64)
                .ok_or_else(|| Fault::new("LIMIT_EXCEEDED"))?;
            *current = Arc::new(next);
        }
        Ok(value)
    }

    // 仅为已校验的包建立内存索引；校验、持久化和授权不由此方法代劳。
    pub(crate) fn register_verified(&self, package: VerifiedPackage) -> Result<bool> {
        self.change(|state| {
            let identity = &package.identity;
            let pair = (identity.plugin_id.clone(), identity.version.clone());
            if let Some(existing) = state.packages.get(&pair) {
                need(existing.identity.package_hash == identity.package_hash, "HASH_MISMATCH")?;
                need(existing.identity.publisher_key_id == identity.publisher_key_id, "SIGNATURE_UNTRUSTED")?;
                return Ok(None);
            }
            let official = identity.plugin_id.starts_with("gamegen.") || state.reserved_plugins.contains(&identity.plugin_id);
            need(!official || package.from_distribution, "CONTRIBUTION_CONFLICT")?;
            let mut ids = BTreeSet::new();
            for contribution in &package.contributions {
                need(contribution.key.package == *identity && ids.insert(contribution.key.id.clone()), "CONTRIBUTION_CONFLICT")?;
                for route in &contribution.routes {
                    if let Some(owner) = state.reserved_routes.get(&(contribution.key.kind.clone(), route.clone())) {
                        need(package.from_distribution && owner == &identity.plugin_id, "CONTRIBUTION_CONFLICT")?;
                    }
                }
            }
            for contribution in &package.contributions {
                let key = contribution.key.clone();
                state.by_kind.entry(key.kind.clone()).or_default().insert(key.clone());
                for route in &contribution.routes {
                    state.by_route.entry((key.kind.clone(), route.clone())).or_default().insert(key.clone());
                }
                state.contributions.insert(key, contribution.clone());
            }
            state.packages.insert(pair, package);
            // 允许缺少依赖的禁用包入库，但已闭合的依赖环不能进入注册表。
            reject_cycles(state)?;
            Ok(Some(()))
        }).map(|value| value.is_some())
    }

    // 受信发行索引须先登记保留身份；不能把普通包的自述作为官方来源。
    pub(crate) fn reserve_distribution(&self, plugins: BTreeSet<String>, routes: BTreeMap<(String, String), String>) -> Result<()> {
        self.change(|state| {
            for package in state.packages.values().filter(|p| !p.from_distribution) {
                need(!plugins.contains(&package.identity.plugin_id), "CONTRIBUTION_CONFLICT")?;
                for c in &package.contributions {
                    need(!c.routes.iter().any(|r| routes.contains_key(&(c.key.kind.clone(), r.clone()))), "CONTRIBUTION_CONFLICT")?;
                }
            }
            for (key, owner) in &routes {
                if let Some(existing) = state.reserved_routes.get(key) { need(existing == owner, "CONTRIBUTION_CONFLICT")?; }
            }
            let before = (state.reserved_plugins.len(), state.reserved_routes.len());
            state.reserved_plugins.extend(plugins);
            state.reserved_routes.extend(routes);
            if before == (state.reserved_plugins.len(), state.reserved_routes.len()) { return Ok(None); }
            Ok(Some(()))
        })?;
        Ok(())
    }

    // 当前没有已接入的平台隔离宿主，不能把已登记的包误报为已启用。
    pub(crate) fn enable(&self, package: &PackageRef) -> Result<()> {
        let snapshot = self.snapshot()?;
        let stored = snapshot.state.packages.get(&(package.plugin_id.clone(), package.version.clone()))
            .ok_or_else(|| Fault::new("DEPENDENCY_MISSING"))?;
        need(stored.identity == *package, "HASH_MISMATCH")?;
        validate_dependencies(&snapshot.state, package)?;
        Err(Fault::new("ISOLATION_UNAVAILABLE"))
    }

    pub(crate) fn list_by_kind(snapshot: &RegistrySnapshot, kind: &str) -> Vec<Entry> {
        Self::entries(snapshot, snapshot.state.by_kind.get(kind))
    }

    pub(crate) fn list_route(snapshot: &RegistrySnapshot, kind: &str, route: &str) -> Vec<Entry> {
        Self::entries(snapshot, snapshot.state.by_route.get(&(kind.to_owned(), route.to_owned())))
    }

    fn entries(snapshot: &RegistrySnapshot, keys: Option<&BTreeSet<ContributionKey>>) -> Vec<Entry> {
        let mut entries: Vec<_> = keys.into_iter().flatten().filter_map(|key| {
            snapshot.state.contributions.get(key).map(|c| Entry {
                contribution: c.clone(), availability: availability(&snapshot.state, key),
            })
        }).collect();
        // 展示次序不能被用于决定冲突或替代显式选择。
        entries.sort_by(|a,b| {
            let a=&a.contribution.key; let b=&b.contribution.key;
            (&a.package.plugin_id,&a.kind,&a.id,&a.package.version,&a.package.package_hash)
                .cmp(&(&b.package.plugin_id,&b.kind,&b.id,&b.package.version,&b.package.package_hash))
        });
        entries
    }

    pub(crate) fn resolve_exact(snapshot: &RegistrySnapshot, key: &ContributionKey) -> Result<Entry> {
        let contribution = snapshot.state.contributions.get(key).ok_or_else(|| Fault::new("NOT_FOUND"))?.clone();
        Ok(Entry { availability: availability(&snapshot.state, key), contribution })
    }

    pub(crate) fn resolve(snapshot: &RegistrySnapshot, selection: Selection<'_>, context: Context<'_>) -> Result<Entry> {
        // 旧 profile 沿原有组件路径，不回退到设备插件默认。
        if matches!(context, Context::Legacy) { return Err(Fault::new("CONTEXT_REQUIRED")); }
        let candidates: Vec<ContributionKey> = match selection {
            Selection::Exact(key) => vec![key.clone()],
            Selection::Plugin { plugin_id, kind, id } => snapshot.state.by_kind.get(kind).into_iter().flatten()
                .filter(|key| key.package.plugin_id == plugin_id && key.id == id).cloned().collect(),
            Selection::Route { kind, route_id } => snapshot.state.by_route.get(&(kind.to_owned(),route_id.to_owned()))
                .into_iter().flatten().cloned().collect(),
        };
        let candidates: Vec<_> = candidates.into_iter().filter(|key| match &context {
            Context::Legacy => false,
            Context::Device => snapshot.state.active.get(&key.package.plugin_id) == Some(&key.package),
            Context::ProjectPinned(pins) => pins.get(&key.package.plugin_id) == Some(&key.package),
        }).collect();
        need(!candidates.is_empty(), "NOT_FOUND")?;
        need(candidates.len() == 1, "CONTRIBUTION_CONFLICT")?;
        Self::resolve_exact(snapshot, &candidates[0])
    }

    // 新任务的 UI 选择必须绑定当前 revision；无关更新不会改写已接收任务。
    pub(crate) fn check_ui_context(&self, snapshot: &RegistrySnapshot, key: &ContributionKey) -> Result<Entry> {
        let current = self.snapshot()?;
        need(current.generation == snapshot.generation && current.revision == snapshot.revision, "STALE_CONTEXT")?;
        Self::resolve_exact(&current, key)
    }

    // 已接收任务只重查原精确身份与资格，不用最新设备默认替换原包。
    pub(crate) fn check_job_package(&self, generation: &str, key: &ContributionKey) -> Result<Entry> {
        let current = self.snapshot()?;
        need(current.generation == generation, "STALE_CONTEXT")?;
        Self::resolve_exact(&current, key)
    }
}

fn availability(state: &State, key: &ContributionKey) -> Availability {
    let Some(package) = state.packages.get(&(key.package.plugin_id.clone(), key.package.version.clone())) else { return Availability::MissingPackage; };
    if package.identity.package_hash != key.package.package_hash { return Availability::HashMismatch; }
    if !package.from_distribution && state.trusted.get(&key.package.plugin_id) != Some(&key.package.publisher_key_id) { return Availability::SignatureUntrusted; }
    if !state.executable.contains(&key.package) { return Availability::Disabled; }
    // 平台和隔离状态只能由真实宿主探测输入，本切片始终保守阻断。
    Availability::IsolationUnavailable
}

fn validate_dependencies(state: &State, root: &PackageRef) -> Result<()> {
    // 不递归调用：不可信依赖链不能耗尽宿主线程栈。
    let mut pending = vec![(root.clone(), false)];
    let mut visiting = BTreeSet::new();
    let mut done = BTreeSet::new();
    let mut chosen = BTreeMap::new();
    while let Some((package, leaving)) = pending.pop() {
        if leaving { visiting.remove(&package); done.insert(package); continue; }
        if done.contains(&package) { continue; }
        need(visiting.insert(package.clone()), "DEPENDENCY_CYCLE")?;
        if let Some(prior) = chosen.get(&package.plugin_id) { need(prior == &package, "DEPENDENCY_CONFLICT")?; }
        else { chosen.insert(package.plugin_id.clone(), package.clone()); }
        let entry = state.packages.get(&(package.plugin_id.clone(), package.version.clone())).ok_or_else(|| Fault::new("DEPENDENCY_MISSING"))?;
        need(entry.identity == package, "DEPENDENCY_CONFLICT")?;
        pending.push((package, true));
        pending.extend(entry.dependencies.iter().rev().cloned().map(|p| (p, false)));
    }
    Ok(())
}

fn reject_cycles(state: &State) -> Result<()> {
    let mut done = BTreeSet::new();
    for package in state.packages.values() {
        let mut visiting = BTreeSet::new();
        let mut pending = vec![(package.identity.clone(), false)];
        while let Some((identity, leaving)) = pending.pop() {
            if leaving { visiting.remove(&identity); done.insert(identity); continue; }
            if done.contains(&identity) { continue; }
            need(visiting.insert(identity.clone()), "DEPENDENCY_CYCLE")?;
            pending.push((identity.clone(), true));
            if let Some(current) = state.packages.get(&(identity.plugin_id.clone(), identity.version.clone())).filter(|p| p.identity == identity) {
                pending.extend(current.dependencies.iter().rev().cloned().map(|p| (p, false)));
            }
        }
    }
    Ok(())
}
