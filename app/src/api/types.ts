export type User = {
  email: string;
  group_id: string;
  role: 'user' | 'admin';
  language: 'ru' | 'en';
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
};

export type LoginResponse = TokenPair & {
  token_type: 'bearer';
  user: User;
};
