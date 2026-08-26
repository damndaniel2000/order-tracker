-- Rebrand: lamatic.test -> likhit.test demo email domain
UPDATE drivers SET email = 'driver@likhit.test' WHERE email = 'driver@lamatic.test';
UPDATE admins SET email = 'admin@likhit.test' WHERE email = 'admin@lamatic.test';
