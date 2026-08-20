// DRAFT legal copy pending review before App Store submission.
// Reflects the actual mechanics: email + portfolio data, no tracking, no ads.
export const LEGAL = {
  privacyTitle: 'Privacy Policy',
  privacy: `AlgoWealth is a personal, invite-only portfolio tracker.

Data we store:
— your email and password (password is stored only as an irreversible hash);
— portfolio data (instruments, values, banks) uploaded by the administrator;
— your watchlist;
— interface language.

How we use it:
— solely to display your portfolio in the app;
— your data is never sold, shared with third parties, or used for advertising;
— the app contains no analytics trackers and no ads.

Stock quotes are fetched from public financial services without sending any of your personal data.

Storage: data is kept on a secured server. Only you (via your password) and the administrator can access it.

Deletion: you can delete your account at any time in Settings. Deletion removes your account and watchlist.

Contact: a.lutsenko@quantillions.com`,
  termsTitle: 'Terms of Service',
  terms: `1. AlgoWealth is a personal information service for portfolio tracking. Access is provided by invitation from the administrator.

2. The app displays data uploaded by the administrator and market quotes from public sources. All information is for reference only and does not constitute investment advice.

3. We do not guarantee uninterrupted service or the accuracy of third-party quotes.

4. You agree not to share your credentials with third parties.

5. Your account can be deleted by you in Settings or by the administrator.

Contact: a.lutsenko@quantillions.com`,
} as const;
