此受控目录接收实际构建的ggcore.dll及同一固定LLVM-MinGW发布物所需运行库。
必须同时提供core-artifact.json：{ "abi":"1.0", "target":"windows-x86_64", "buildId":"实际构建编号", "files":[{"name":"ggcore.dll","sha256":"实际64位十六进制摘要"}] }。
files列出全部非系统DLL；文件名必须为单级.dll，不允许链接、未知目录或PATH回退。未放入实际产物时host.describe的coreAbi为null，打开项目明确失败。
该说明不构成已构建或已校验的制品清单；不要用示例摘要代填。
