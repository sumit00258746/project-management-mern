import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BASEURL,
});

export default api;

// find workspace and project by id and update task in it
