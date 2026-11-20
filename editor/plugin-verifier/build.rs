// 真实构建输入绑定尚未接入；禁止将无身份开发产物构建成发布配置。
fn main() {
    if std::env::var("PROFILE").as_deref()!=Ok("debug") {
        panic!("插件核验器尚无真实构建身份，禁止发布配置");
    }
}
