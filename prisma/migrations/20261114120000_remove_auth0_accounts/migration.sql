-- Auth0 is removed (D-178): its logins can no longer be used, so drop them.
-- Only external-login rows go; the users and their password and Google
-- logins stay. No table references accounts.
DELETE FROM "accounts" WHERE "provider_id" = 'auth0';
