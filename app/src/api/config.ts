export const API_BASE_URL = 'https://your-server.example.com/api/app';

/** Root for backend static files (/uploads/...) — post covers and attachments. */
export const FILES_BASE_URL = API_BASE_URL.replace(/\/api\/app$/, '');

export const fileUrl = (path: string) =>
  path.startsWith('/') ? `${FILES_BASE_URL}${path}` : path;
