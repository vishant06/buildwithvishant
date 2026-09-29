import request from "./api.js";

export const listProjects = () => request("/projects");
export const getProject = (id) => request(`/projects/${id}`);
