// 单一应用实例拥有编辑会话；不以locale或路由作根组件key。
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
const root=document.getElementById("root");
if (!root) throw new Error("ROOT_MISSING");
createRoot(root).render(<App/>);
