-- ============================================================================
-- Football First — Migración 0034: nombres de estadios de la agencia
--
-- Punto 10 de la agencia (listas de estadios de Gerardo, 2026-09-30: WebFirst/Estadios.xlsx y
-- WebFirst/Estadios uruguay.xlsx). Opción a (Gerardo): se muestra el estadio y la ciudad como los
-- usa la agencia cuando el partido es en la cancha HABITUAL del local; si la fuente trae otra
-- (neutral, mudanza, el Centenario cuando un chico recibe a Peñarol) se respeta la fuente; si la
-- fuente no trae estadio, se usa el de la agencia como respaldo.
--
-- 1. Tabla `estadios_equipo`: por equipo, los nombres con que lo llaman las fuentes (alias), su
--    estadio/ciudad de la agencia y cómo llaman las fuentes a ESA cancha (nombres_fuente). Datos:
--    supabase/datos/estadios-agencia.json (Excel + equivalencias revisadas a mano por Claude).
-- 2. Trigger en `partidos` (todas las syncs pasan por acá): reemplaza estadio/ciudad según (1).
-- 3. Corrección única de los partidos ya cargados.
--
-- Reversible: drop trigger partidos_estadio_agencia on partidos; drop function
-- partidos_estadio_agencia(); drop table estadios_equipo. (Los nombres ya reemplazados vuelven a los
-- de la fuente en la próxima sync.)
-- Football First. Creado 2026-09-30.
-- ============================================================================

begin;

create table estadios_equipo (
  id             bigserial primary key,
  equipo         text not null unique,
  liga           text,
  alias          text[] not null,
  estadio        text not null,
  ciudad         text,
  pais           text,
  nombres_fuente text[] not null default '{}'
);
comment on table estadios_equipo is 'Estadio y ciudad de cada equipo como los usa la agencia (0034). Lo usa el trigger partidos_estadio_agencia; el front no la lee.';

alter table estadios_equipo enable row level security;
revoke all on estadios_equipo from anon, authenticated;

insert into estadios_equipo (equipo, liga, alias, estadio, ciudad, pais, nombres_fuente) values
  ('América', 'Liga MX', array['América']::text[], 'Estadio Azteca', 'Ciudad de México', 'México', array['Mexico City Stadium', 'Estadio Azteca', 'Estadio Banorte']::text[]),
  ('Atlante', 'Liga MX', array['Atlante FC', 'Atlante']::text[], 'Estadio Ciudad de los Deportes', 'Ciudad de México', 'México', array['Estadio Ciudad de los Deportes']::text[]),
  ('Atlas', 'Liga MX', array['Atlas']::text[], 'Estadio Jalisco', 'Guadalajara', 'México', array['Estadio Jalisco']::text[]),
  ('Atlético San Luis', 'Liga MX', array['Atlético de San Luis', 'Atlético San Luis']::text[], 'Estadio Libertad Financiera', 'San Luis Potosí', 'México', array['Estadio Alfonso Lastras Ramírez', 'Estadio Libertad Financiera']::text[]),
  ('Cruz Azul', 'Liga MX', array['Cruz Azul']::text[], 'Estadio Ciudad de los Deportes', 'Ciudad de México', 'México', array['Estadio Ciudad de los Deportes']::text[]),
  ('Guadalajara', 'Liga MX', array['Guadalajara']::text[], 'Estadio Akron', 'Zapopan', 'México', array['Guadalajara Stadium', 'Estadio Akron']::text[]),
  ('FC Juárez', 'Liga MX', array['FC Juarez', 'Juárez', 'FC Juárez']::text[], 'Estadio Olímpico Benito Juárez', 'Ciudad Juárez', 'México', array['Estadio Olímpico Benito Juárez']::text[]),
  ('León', 'Liga MX', array['León']::text[], 'Estadio León', 'León', 'México', array['Estadio León', 'Estadio Nou Camp']::text[]),
  ('Monterrey', 'Liga MX', array['Monterrey']::text[], 'Estadio BBVA', 'Guadalupe', 'México', array['Monterrey Stadium', 'Estadio BBVA']::text[]),
  ('Necaxa', 'Liga MX', array['Necaxa']::text[], 'Estadio Victoria', 'Aguascalientes', 'México', array['Estadio Victoria de Aguascalientes', 'Estadio Victoria']::text[]),
  ('Pachuca', 'Liga MX', array['Pachuca', 'CF Pachuca']::text[], 'Estadio Hidalgo', 'Pachuca', 'México', array['Estadio Hidalgo']::text[]),
  ('Puebla', 'Liga MX', array['Puebla']::text[], 'Estadio Cuauhtémoc', 'Puebla', 'México', array['Estadio Cuauhtémoc']::text[]),
  ('Pumas UNAM', 'Liga MX', array['Pumas UNAM']::text[], 'Estadio Olímpico Universitario', 'Ciudad de México', 'México', array['Estadio Olímpico de Universitario', 'Estadio Olímpico Universitario']::text[]),
  ('Querétaro', 'Liga MX', array['Querétaro']::text[], 'Estadio Corregidora', 'Querétaro', 'México', array['Estadio La Corregidora', 'Estadio Corregidora']::text[]),
  ('Santos Laguna', 'Liga MX', array['Santos Laguna']::text[], 'Estadio Corona', 'Torreón', 'México', array['Estadio Nuevo Corona', 'Estadio Corona']::text[]),
  ('Tigres UANL', 'Liga MX', array['Tigres UANL']::text[], 'Estadio Universitario', 'San Nicolás de los Garza', 'México', array['Estadio Universitario de Nuevo León', 'Estadio Universitario']::text[]),
  ('Tijuana', 'Liga MX', array['Tijuana']::text[], 'Estadio Caliente', 'Tijuana', 'México', array['Estadio Caliente']::text[]),
  ('Toluca', 'Liga MX', array['Toluca']::text[], 'Estadio Nemesio Díez', 'Toluca', 'México', array['Estadio Nemesio Díez', 'Estadio Nemesio Diez']::text[]),
  ('Flamengo', 'Brasileirão Serie A', array['Flamengo']::text[], 'Maracanã', 'Río de Janeiro', 'Brasil', array['Estadio Jornalista Mário Filho', 'Estádio Jornalista Mário Filho', 'Maracanã', 'Estádio do Maracanã']::text[]),
  ('Fluminense', 'Brasileirão Serie A', array['Fluminense']::text[], 'Maracanã', 'Río de Janeiro', 'Brasil', array['Estadio Jornalista Mário Filho', 'Estádio Jornalista Mário Filho', 'Maracanã', 'Estádio do Maracanã']::text[]),
  ('Botafogo', 'Brasileirão Serie A', array['Botafogo']::text[], 'Estadio Nilton Santos', 'Río de Janeiro', 'Brasil', array['Estádio Nilton Santos', 'Estadio Nilton Santos']::text[]),
  ('Vasco da Gama', 'Brasileirão Serie A', array['Vasco da Gama']::text[], 'São Januário', 'Río de Janeiro', 'Brasil', array['Estádio Club de Regatas Vasco da Gama', 'Estádio São Januário', 'São Januário']::text[]),
  ('Corinthians', 'Brasileirão Serie A', array['Corinthians']::text[], 'Neo Química Arena', 'São Paulo', 'Brasil', array['Arena Corinthians', 'Neo Química Arena']::text[]),
  ('Palmeiras', 'Brasileirão Serie A', array['Palmeiras']::text[], 'Allianz Parque', 'São Paulo', 'Brasil', array['Allianz Parque']::text[]),
  ('São Paulo', 'Brasileirão Serie A', array['São Paulo']::text[], 'Morumbi', 'São Paulo', 'Brasil', array['Estádio Cícero Pompeu de Toledo', 'Morumbi', 'MorumBIS']::text[]),
  ('Santos', 'Brasileirão Serie A', array['Santos']::text[], 'Vila Belmiro', 'Santos', 'Brasil', array['Estádio Urbano Caldeira', 'Vila Belmiro']::text[]),
  ('Athletico Paranaense', 'Brasileirão Serie A', array['Athletico PR', 'Athletico Paranaense']::text[], 'Ligga Arena', 'Curitiba', 'Brasil', array['Estádio Joaquim Américo Guimarães', 'Ligga Arena', 'Arena da Baixada']::text[]),
  ('Coritiba', 'Brasileirão Serie A', array['Coritiba']::text[], 'Couto Pereira', 'Curitiba', 'Brasil', array['Estádio Major Antônio Couto Pereira', 'Couto Pereira']::text[]),
  ('Atlético Mineiro', 'Brasileirão Serie A', array['Atlético Mineiro']::text[], 'Arena MRV', 'Belo Horizonte', 'Brasil', array['Arena MRV']::text[]),
  ('Cruzeiro', 'Brasileirão Serie A', array['Cruzeiro']::text[], 'Mineirão', 'Belo Horizonte', 'Brasil', array['Estádio Governador Magalhães Pinto', 'Mineirão']::text[]),
  ('Grêmio', 'Brasileirão Serie A', array['Grêmio']::text[], 'Arena do Grêmio', 'Porto Alegre', 'Brasil', array['Arena do Grêmio']::text[]),
  ('Internacional', 'Brasileirão Serie A', array['Internacional', 'SC Internacional']::text[], 'Beira-Rio', 'Porto Alegre', 'Brasil', array['Estadio Beira-Rio', 'Estádio José Pinheiro Borda', 'Beira-Rio']::text[]),
  ('Bahia', 'Brasileirão Serie A', array['Bahia']::text[], 'Arena Fonte Nova', 'Salvador', 'Brasil', array['Arena Fonte Nova']::text[]),
  ('Vitória', 'Brasileirão Serie A', array['Vitória']::text[], 'Barradão', 'Salvador', 'Brasil', array['Estádio Manoel Barradas', 'Barradão']::text[]),
  ('Chapecoense', 'Brasileirão Serie A', array['Chapecoense', 'Chapecoense-sc']::text[], 'Arena Condá', 'Chapecó', 'Brasil', array['Arena Condá']::text[]),
  ('Mirassol', 'Brasileirão Serie A', array['Mirassol']::text[], 'Estadio José Maria de Campos Maia', 'Mirassol', 'Brasil', array['Estádio José Maria de Campos Maia', 'Estadio José Maria de Campos Maia']::text[]),
  ('Red Bull Bragantino', 'Brasileirão Serie A', array['RB Bragantino', 'Red Bull Bragantino']::text[], 'Nabi Abi Chedid', 'Bragança Paulista', 'Brasil', array['Estádio Nabi Abi Chedid', 'Nabi Abi Chedid']::text[]),
  ('Remo', 'Brasileirão Serie A', array['Remo']::text[], 'Mangueirão', 'Belém', 'Brasil', array['Estádio Estadual Jornalista Edgar Augusto Proença', 'Mangueirão']::text[]),
  ('Anderlecht', 'Jupiler Pro League', array['Anderlecht']::text[], 'Lotto Park', 'Bruselas', 'Bélgica', array['Lotto Park']::text[]),
  ('Antwerp', 'Jupiler Pro League', array['Antwerp']::text[], 'Bosuilstadion', 'Deurne', 'Bélgica', array['Bosuilstadion']::text[]),
  ('Club Brugge', 'Jupiler Pro League', array['Club Brugge']::text[], 'Jan Breydelstadion', 'Brujas', 'Bélgica', array['Jan Breydelstadion']::text[]),
  ('Cercle Brugge', 'Jupiler Pro League', array['Cercle Brugge KSV', 'Cercle Brugge']::text[], 'Jan Breydelstadion', 'Brujas', 'Bélgica', array['Jan Breydelstadion']::text[]),
  ('Genk', 'Jupiler Pro League', array['Genk']::text[], 'Cegeka Arena', 'Genk', 'Bélgica', array['Cegeka Arena']::text[]),
  ('Gent', 'Jupiler Pro League', array['KAA Gent', 'Gent']::text[], 'Planet Group Arena', 'Gante', 'Bélgica', array['Planet Group Arena', 'Ghelamco Arena']::text[]),
  ('Standard Liège', 'Jupiler Pro League', array['Standard Liege', 'Standard Liège']::text[], 'Stade Maurice Dufrasne', 'Lieja', 'Bélgica', array['Stade Maurice Dufrasne']::text[]),
  ('Charleroi', 'Jupiler Pro League', array['Royal Charleroi SC', 'Sporting Charleroi']::text[], 'Stade du Pays de Charleroi', 'Charleroi', 'Bélgica', array['Stade du Pays de Charleroi']::text[]),
  ('Mechelen', 'Jupiler Pro League', array['KV Mechelen', 'Mechelen']::text[], 'Achter de Kazerne', 'Malinas', 'Bélgica', array['Achter de Kazerne']::text[]),
  ('OH Leuven', 'Jupiler Pro League', array['Oud-Heverlee Leuven', 'OH Leuven']::text[], 'King Power at Den Dreef', 'Heverlee', 'Bélgica', array['King Power at Den Dreef']::text[]),
  ('Sint-Truiden', 'Jupiler Pro League', array['Sint-Truidense', 'Sint-Truiden']::text[], 'Stayen Stadium', 'Sint-Truiden', 'Bélgica', array['Stayen Stadion', 'Stayen Stadium']::text[]),
  ('Kortrijk', 'Jupiler Pro League', array['KV Kortrijk', 'Kortrijk']::text[], 'Guldensporenstadion', 'Kortrijk', 'Bélgica', array['Guldensporen Stadion', 'Guldensporenstadion']::text[]),
  ('Union Saint-Gilloise', 'Jupiler Pro League', array['Union St.-Gilloise', 'Union Saint-Gilloise']::text[], 'Stade Joseph Mariën', 'Bruselas', 'Bélgica', array['Stade Joseph Mariën']::text[]),
  ('Westerlo', 'Jupiler Pro League', array['KVC Westerlo', 'Westerlo']::text[], 'Het Kuipje', 'Westerlo', 'Bélgica', array['Het Kuipje']::text[]),
  ('Zulte-Waregem', 'Jupiler Pro League', array['Zulte-Waregem']::text[], 'Elindus Arena', 'Waregem', 'Bélgica', array['Elindus Arena']::text[]),
  ('Lommel SK', 'Jupiler Pro League', array['Lommel SK']::text[], 'Soeverein Stadion', 'Lommel', 'Bélgica', array['Soevereinstadion', 'Soeverein Stadion']::text[]),
  ('SK Beveren', 'Jupiler Pro League', array['Waasland-Beveren', 'SK Beveren']::text[], 'Freethielstadion', 'Beveren', 'Bélgica', array['Freethiel-Stadion', 'Freethielstadion']::text[]),
  ('RAAL La Louvière', 'Jupiler Pro League', array['RAAL La Louvière', 'La Louvière']::text[], 'Easi Arena', 'La Louvière', 'Bélgica', array['Stade du Tivoli', 'Easi Arena']::text[]),
  ('Colo Colo', 'Primera División Chile', array['Colo-Colo', 'Colo Colo']::text[], 'Estadio Monumental David Arellano', 'Santiago', 'Chile', array['Estadio Monumental David Arellano']::text[]),
  ('Universidad de Chile', 'Primera División Chile', array['Universidad Chile', 'Universidad de Chile']::text[], 'Estadio Nacional Julio Martínez Prádanos', 'Santiago', 'Chile', array['Estadio Nacional Julio Martínez Prádanos']::text[]),
  ('Universidad Católica', 'Primera División Chile', array['Universidad Católica']::text[], 'Claro Arena', 'Santiago', 'Chile', array['Estadio San Carlos de Apoquindo', 'Claro Arena']::text[]),
  ('Unión Española', 'Primera División Chile', array['Unión Española']::text[], 'Estadio Santa Laura', 'Santiago', 'Chile', array['Estadio Santa Laura-Universidad SEK', 'Estadio Santa Laura']::text[]),
  ('Audax Italiano', 'Primera División Chile', array['Audax Italiano', 'A. Italiano']::text[], 'Estadio Bicentenario La Florida', 'Santiago', 'Chile', array['Estadio Bicentenario Municipal de La Florida', 'Estadio Bicentenario La Florida']::text[]),
  ('Palestino', 'Primera División Chile', array['Palestino']::text[], 'Estadio Municipal de La Cisterna', 'Santiago', 'Chile', array['Estadio Municipal de La Cisterna']::text[]),
  ('Unión La Calera', 'Primera División Chile', array['Unión La Calera']::text[], 'Estadio Nicolás Chahuán Nazar', 'La Calera', 'Chile', array['Estadio Municipal Nicolás Chahuán Nazar', 'Estadio Nicolás Chahuán Nazar']::text[]),
  ('Everton', 'Primera División Chile', array['Everton']::text[], 'Estadio Sausalito', 'Viña del Mar', 'Chile', array['Estadio Sausalito']::text[]),
  ('Coquimbo Unido', 'Primera División Chile', array['Coquimbo Unido']::text[], 'Estadio Francisco Sánchez Rumoroso', 'Coquimbo', 'Chile', array['Estadio Bicentenario Francisco Sánchez Rumoroso', 'Estadio Francisco Sánchez Rumoroso']::text[]),
  ('Deportes La Serena', 'Primera División Chile', array['La Serena', 'Deportes La Serena']::text[], 'Estadio La Portada', 'La Serena', 'Chile', array['Estadio La Portada de La Serena', 'Estadio La Portada']::text[]),
  ('Ñublense', 'Primera División Chile', array['Ñublense']::text[], 'Estadio Nelson Oyarzún', 'Chillán', 'Chile', array['Estadio Bicentenario Municipal Nelson Oyarzún', 'Estadio Nelson Oyarzún']::text[]),
  ('O’Higgins', 'Primera División Chile', array['O''Higgins', 'O’Higgins']::text[], 'Estadio El Teniente', 'Rancagua', 'Chile', array['Estadio El Teniente']::text[]),
  ('Cobresal', 'Primera División Chile', array['Cobresal']::text[], 'Estadio El Cobre', 'El Salvador', 'Chile', array['Estadio El Cobre']::text[]),
  ('Huachipato', 'Primera División Chile', array['Huachipato']::text[], 'Estadio CAP', 'Talcahuano', 'Chile', array['Estadio Huachipato-CAP Acero', 'Estadio CAP']::text[]),
  ('Deportes Concepción', 'Primera División Chile', array['Deportes Concepcion', 'Deportes Concepción', 'Concepcion', 'Concepción']::text[], 'Estadio Ester Roa Rebolledo', 'Concepción', 'Chile', array['Estadio Municipal Alcaldesa Ester Roa Rebolledo', 'Estadio Ester Roa Rebolledo']::text[]),
  ('Deportes Limache', 'Primera División Chile', array['Deportes Limache']::text[], 'Estadio Lucio Fariña Fernández', 'Quillota', 'Chile', array['Estadio Municipal Lucio Fariña Fernández', 'Estadio Lucio Fariña Fernández']::text[]),
  ('Al Hilal', 'Saudi Pro League', array['Al Hilal']::text[], 'Kingdom Arena', 'Riad', 'Arabia Saudita', array['Kingdom Arena']::text[]),
  ('Al Nassr', 'Saudi Pro League', array['Al Nassr']::text[], 'Al-Awwal Park', 'Riad', 'Arabia Saudita', array['Al-Awwal Park']::text[]),
  ('Al Shabab', 'Saudi Pro League', array['Al Shabab']::text[], 'Prince Faisal bin Fahd Stadium', 'Riad', 'Arabia Saudita', array['Prince Faisal bin Fahd Stadium']::text[]),
  ('Al Ittihad', 'Saudi Pro League', array['Al Ittihad']::text[], 'King Abdullah Sport City Stadium', 'Yeda', 'Arabia Saudita', array['King Abdullah Sport City Stadium', 'King Abdullah Sports City', 'Alinma Stadium']::text[]),
  ('Al Ahli', 'Saudi Pro League', array['Al Ahli', 'Al-Ahli Jeddah']::text[], 'Prince Abdullah Al Faisal Stadium', 'Yeda', 'Arabia Saudita', array['Prince Abdullah Al Faisal Stadium']::text[]),
  ('Al Fateh', 'Saudi Pro League', array['Al Fateh']::text[], 'Prince Abdullah bin Jalawi Stadium', 'Al Hofuf', 'Arabia Saudita', array['Prince Abdullah bin Jalawi Sports City Stadium', 'Prince Abdullah bin Jalawi Stadium']::text[]),
  ('Al Ettifaq', 'Saudi Pro League', array['Al Ettifaq', 'Al-Ettifaq']::text[], 'Prince Mohamed bin Fahd Stadium', 'Dammam', 'Arabia Saudita', array['EGO STADIUM', 'Prince Mohamed bin Fahd Stadium', 'Prince Mohamed bin Fahd Stadium (Ad Dammām (Dammam))']::text[]),
  ('Al Khaleej', 'Saudi Pro League', array['Al Khaleej']::text[], 'Prince Nayef bin Abdulaziz Stadium', 'Saihat', 'Arabia Saudita', array['Prince Nayef bin Abdul Aziz Sports City Stadium', 'Prince Nayef bin Abdulaziz Stadium']::text[]),
  ('Al Taawoun', 'Saudi Pro League', array['Al Taawoun']::text[], 'King Abdullah Sport City Stadium', 'Buraidah', 'Arabia Saudita', array['King Abdullah Sport City Stadium']::text[]),
  ('Al Hazm', 'Saudi Pro League', array['Al Hazm']::text[], 'Al Hazm Club Stadium', 'Ar Rass', 'Arabia Saudita', array['Ar-Rass Stadium (Al Hazm Club Stadium) (Ar-Rass (Rass))', 'Al Hazm Club Stadium']::text[]),
  ('Abha', 'Saudi Pro League', array['Abha']::text[], 'Prince Sultan bin Abdulaziz Stadium', 'Abha', 'Arabia Saudita', array['Prince Sultan bin Abdul Aziz Stadium', 'Prince Sultan bin Abdulaziz Stadium']::text[]),
  ('Damac', 'Saudi Pro League', array['Damac FC', 'Damac']::text[], 'Damac Club Stadium', 'Khamis Mushait', 'Arabia Saudita', array['Dhamak Club Stadium', 'Damac Club Stadium']::text[]),
  ('Al Raed', 'Saudi Pro League', array['Al Raed']::text[], 'King Abdullah Sport City Stadium', 'Buraidah', 'Arabia Saudita', array['King Abdullah Sport City Stadium']::text[]),
  ('Al Majma’ah', 'Saudi Pro League', array['Al Majma''ah', 'Al-Majma’ah', 'Al Majma’ah']::text[], 'Al Majma’ah Sports City', 'Al Majma’ah', 'Arabia Saudita', array['Al Majma’ah Sports City']::text[]),
  ('Albion FC', 'Primera División Uruguay', array['Albion FC']::text[], 'Parque Federico Omar Saroldi', 'Montevideo', 'Uruguay', array['Parque Federico Omar Saroldi']::text[]),
  ('Boston River', 'Primera División Uruguay', array['Boston River']::text[], 'Estadio Campeones Olímpicos', 'Florida', 'Uruguay', array['Estadio Campeones Olímpicos']::text[]),
  ('Central Español', 'Primera División Uruguay', array['Central Español Fútbol Club', 'Central Español']::text[], 'Parque Palermo', 'Montevideo', 'Uruguay', array['Parque Palermo']::text[]),
  ('Cerro', 'Primera División Uruguay', array['Cerro']::text[], 'Estadio Luis Tróccoli', 'Montevideo', 'Uruguay', array['Estadio Luis Tróccoli']::text[]),
  ('Cerro Largo', 'Primera División Uruguay', array['Cerro Largo']::text[], 'Estadio Arquitecto Antonio Ubilla', 'Melo', 'Uruguay', array['Estadio Arquitecto Antonio Ubilla', 'Estadio Antonio Ubilla']::text[]),
  ('Danubio', 'Primera División Uruguay', array['Danubio']::text[], 'Estadio Jardines del Hipódromo', 'Montevideo', 'Uruguay', array['Estadio Jardines del Hipódromo', 'Jardines del Hipódromo']::text[]),
  ('Defensor Sporting', 'Primera División Uruguay', array['Defensor Sporting']::text[], 'Estadio Luis Franzini', 'Montevideo', 'Uruguay', array['Estadio Luis Franzini']::text[]),
  ('Deportivo Maldonado', 'Primera División Uruguay', array['Deportivo Maldonado']::text[], 'Estadio Domingo Burgueño Miguel', 'Maldonado', 'Uruguay', array['Estadio Domingo Burgueño Miguel', 'Estadio Domingo Burgueño']::text[]),
  ('Juventud', 'Primera División Uruguay', array['Juventud']::text[], 'Estadio Juventud Parque Artigas', 'Las Piedras', 'Uruguay', array['Estadio Parque Artigas', 'Estadio Juventud Parque Artigas']::text[]),
  ('Liverpool', 'Primera División Uruguay', array['Liverpool']::text[], 'Estadio Belvedere', 'Montevideo', 'Uruguay', array['Estadio Belvedere']::text[]),
  ('Montevideo City Torque', 'Primera División Uruguay', array['Montevideo City Torque']::text[], 'Estadio Charrúa', 'Montevideo', 'Uruguay', array['Estadio Charrúa']::text[]),
  ('Montevideo Wanderers', 'Primera División Uruguay', array['Montevideo Wanderers']::text[], 'Estadio Alfredo Víctor Viera', 'Montevideo', 'Uruguay', array['Parque Alfredo Víctor Viera', 'Estadio Alfredo Víctor Viera']::text[]),
  ('Nacional', 'Primera División Uruguay', array['Club Nacional', 'Nacional']::text[], 'Estadio Gran Parque Central', 'Montevideo', 'Uruguay', array['Gran Parque Central', 'Estadio Gran Parque Central']::text[]),
  ('Peñarol', 'Primera División Uruguay', array['CA Peñarol', 'Peñarol']::text[], 'Estadio Campeón del Siglo', 'Montevideo', 'Uruguay', array['Estadio Campeón del Siglo', 'Campeón del Siglo']::text[]),
  ('Progreso', 'Primera División Uruguay', array['Progreso']::text[], 'Estadio Abraham Paladino', 'Montevideo', 'Uruguay', array['Parque Abraham Paladino', 'Estadio Abraham Paladino']::text[]),
  ('Racing Club', 'Primera División Uruguay', array['Racing (Montevideo)', 'Racing Club']::text[], 'Estadio Parque Osvaldo Roberto', 'Montevideo', 'Uruguay', array['Parque Osvaldo Roberto', 'Estadio Parque Osvaldo Roberto']::text[]);

create or replace function partidos_estadio_agencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_local   text;
  v_fila    estadios_equipo%rowtype;
  v_n       int;
  v_estadio text;
  v_ciudad  text;
begin
  -- Regla 1 — cancha habitual del local (o sin dato): nombre y ciudad de la agencia.
  if new.club_local_id is not null then
    select c.nombre into v_local from clubes c where c.id = new.club_local_id;
    select e.* into v_fila
    from estadios_equipo e
    where exists (select 1 from unnest(e.alias) a where lower(btrim(a)) = lower(btrim(v_local)))
    limit 1;
    if found and (
      new.estadio is null
      or lower(btrim(new.estadio)) = lower(btrim(v_fila.estadio))
      or exists (select 1 from unnest(v_fila.nombres_fuente) f where lower(btrim(f)) = lower(btrim(new.estadio)))
    ) then
      new.estadio := v_fila.estadio;
      new.ciudad  := coalesce(v_fila.ciudad, new.ciudad);
      return new;
    end if;
  end if;
  -- Regla 2 — otra cancha (se respeta la fuente), pero si es la habitual de OTRO equipo de la tabla
  -- y el nombre no es ambiguo (una sola cancha de la agencia), se muestra con el nombre de la
  -- agencia. Ej.: Atlante de local en el Azteca → "Mexico City Stadium" = "Estadio Azteca".
  if new.estadio is not null then
    select count(distinct (e.estadio, e.ciudad)), min(e.estadio), min(e.ciudad)
      into v_n, v_estadio, v_ciudad
    from estadios_equipo e
    where lower(btrim(e.estadio)) = lower(btrim(new.estadio))
       or exists (select 1 from unnest(e.nombres_fuente) f where lower(btrim(f)) = lower(btrim(new.estadio)));
    if v_n = 1 then
      new.estadio := v_estadio;
      new.ciudad  := coalesce(v_ciudad, new.ciudad);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function partidos_estadio_agencia() from public, anon, authenticated;

create trigger partidos_estadio_agencia
  before insert or update of estadio, ciudad, club_local_id on partidos
  for each row execute function partidos_estadio_agencia();

-- Corrección única: dispara el trigger en todos los partidos (regla 1 y regla 2).
update partidos set estadio = estadio;

commit;
