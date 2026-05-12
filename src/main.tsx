import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DownloadManagerProvider } from "./context/DownloadManagerContext";
import "./global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <DownloadManagerProvider>
            <App />
        </DownloadManagerProvider>
    </React.StrictMode>,
);
