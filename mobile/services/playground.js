import request from "./api.js";

// Public — same sandboxed execution API the website's Playground uses.
export const execute = ({ language, code, stdin }) =>
  request("/playground/execute", { method: "POST", body: JSON.stringify({ language, code, stdin }) });

// Authenticated — saved playground projects.
export const myProjects = () => request("/playground/my");
export const saveProject = (payload) => request("/playground", { method: "POST", body: JSON.stringify(payload) });
export const updateProject = (id, payload) => request(`/playground/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteProject = (id) => request(`/playground/${id}`, { method: "DELETE" });
