import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setupGlobalErrorHandling } from "./lib/global-error-handler";

// Setup global error handling
setupGlobalErrorHandling();

createRoot(document.getElementById("root")!).render(<App />);
