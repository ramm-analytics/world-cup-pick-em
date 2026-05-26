insert into public.national_teams (fifa_code, name, confederation, group_name, flag_emoji) values
  ('USA', 'United States', 'CONCACAF', 'D', '🇺🇸'),
  ('MEX', 'Mexico', 'CONCACAF', 'A', '🇲🇽'),
  ('CAN', 'Canada', 'CONCACAF', 'B', '🇨🇦'),
  ('ARG', 'Argentina', 'CONMEBOL', 'C', '🇦🇷'),
  ('BRA', 'Brazil', 'CONMEBOL', 'E', '🇧🇷'),
  ('FRA', 'France', 'UEFA', 'F', '🇫🇷'),
  ('ENG', 'England', 'UEFA', 'G', '🏴'),
  ('ESP', 'Spain', 'UEFA', 'H', '🇪🇸')
on conflict (fifa_code) do nothing;

insert into public.players (team_id, name, position, club, projected_points)
select nt.id, p.name, p.position, p.club, p.projected_points
from public.national_teams nt
join (values
  ('USA', 'Christian Pulisic', 'FW', 'AC Milan', 42),
  ('USA', 'Weston McKennie', 'MF', 'Juventus', 28),
  ('MEX', 'Santiago Gimenez', 'FW', 'Feyenoord', 36),
  ('CAN', 'Alphonso Davies', 'DF', 'Bayern Munich', 34),
  ('ARG', 'Lionel Messi', 'FW', 'Inter Miami', 54),
  ('ARG', 'Julian Alvarez', 'FW', 'Atletico Madrid', 38),
  ('BRA', 'Vinicius Junior', 'FW', 'Real Madrid', 50),
  ('BRA', 'Rodrygo', 'FW', 'Real Madrid', 40),
  ('FRA', 'Kylian Mbappe', 'FW', 'Real Madrid', 56),
  ('FRA', 'Antoine Griezmann', 'MF', 'Atletico Madrid', 36),
  ('ENG', 'Harry Kane', 'FW', 'Bayern Munich', 52),
  ('ENG', 'Jude Bellingham', 'MF', 'Real Madrid', 46),
  ('ESP', 'Pedri', 'MF', 'Barcelona', 32),
  ('ESP', 'Lamine Yamal', 'FW', 'Barcelona', 35)
) as p(fifa_code, name, position, club, projected_points) on p.fifa_code = nt.fifa_code
on conflict (team_id, name) do nothing;
