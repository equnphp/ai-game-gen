# 开发侧源码接收补记

版本：local-core-v1-handoff.3；依据为开发会话追加进度，以及本架构会话对固定tag源码和native vendor文件的只读字节核对。没有构建、预处理、测试或扫描。

严格SHA-256配置下，最小C翻译单元仍是sha256.c、platform_util.c；直接需要的上游私有头为common.h、alignment.h，另保留完整同版本include/。当前两个C文件/common.h/alignment.h的native字节SHA-256已与官方固定tag一致。constant_time_internal.h也已核对同tag，但当前hash-only include链不使用它；它自身引用constant_time_impl.h不意味着本包需要额外编译constant_time.c或引入其加密模块。若后续编译确实走到该链，应先检查配置/额外模块来源并向架构报告，不盲目扩大功能开关。

开发侧从同tag codeload取源是另一个归档来源，已报告ZIP SHA-256=d359314abc9bced38ddf9f0f9423e8c1c5084113a00f26d6864e1ceea6bf1153；本会话未独立读取该ZIP，不能将该值写为本会话observed。已逐文件匹配的固定版本C/私有头可沿用；完整include/来源和剩余字节接收由开发侧记录，不称整个ZIP或完整Mbed TLS已验证。架构侧另已保留官方tar.bz2且匹配官方校验，可直接从本地evidence/downloads/mbedtls-3.6.7.tar.bz2取得同版文件，避免再次联网。

SQLite是开发会话报告的Range续传进度，尚未收到其完整包与最终校验结果；不得把部分933888字节当完整接收。开发完成后按官方SHA3-256核对并写实际SHA-256。JSON开发侧单头报告值与架构侧实取/官方值一致。具体当前记录见evidence/developer-vendor-progress.json和dependencies.receipt.lock.json；expected/observed不混写。
