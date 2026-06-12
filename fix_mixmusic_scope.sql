UPDATE users SET pref_group_mixmusic = '27753a94-3644-4b6b-a2c1-f972d2b8d2ba' WHERE active_group_id = '27753a94-3644-4b6b-a2c1-f972d2b8d2ba';
UPDATE users SET pref_group_mixmusic = 'bd6bcc53-9644-4082-b5c9-50b817128ee5' WHERE active_group_id = 'bd6bcc53-9644-4082-b5c9-50b817128ee5';
UPDATE mixmusic_track_hearts SET group_id = '27753a94-3644-4b6b-a2c1-f972d2b8d2ba' WHERE user_id IS NULL AND group_id IS NULL;
UPDATE mixmusic_track_meta SET group_id = '27753a94-3644-4b6b-a2c1-f972d2b8d2ba' WHERE user_id IS NULL AND group_id IS NULL;
SELECT 'users bijgewerkt:', COUNT(*) FROM users WHERE pref_group_mixmusic IS NOT NULL;
SELECT 'hearts MusicLover:', COUNT(*) FROM mixmusic_track_hearts WHERE group_id = '27753a94-3644-4b6b-a2c1-f972d2b8d2ba';
SELECT 'meta MusicLover:', COUNT(*) FROM mixmusic_track_meta WHERE group_id = '27753a94-3644-4b6b-a2c1-f972d2b8d2ba';
