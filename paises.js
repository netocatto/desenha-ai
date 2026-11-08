// =============================================================
//  DESENHA AÍ! — países do Jogo das Bandeiras
//  código ISO | nome | capital | continente | curiosidade (ponto turístico ou característica)
//  As bandeiras ficam em flags/<código>.svg (projeto flag-icons, licença MIT).
// =============================================================
(function (root) {
const DADOS = `
af|Afeganistão|Cabul|Ásia|Montanhas do Hindu Kush e os famosos tapetes artesanais
za|África do Sul|Pretória|África|Cidade do Cabo, Montanha da Mesa e Nelson Mandela
al|Albânia|Tirana|Europa|A bandeira tem uma águia preta de duas cabeças
de|Alemanha|Berlim|Europa|Portão de Brandemburgo e a Oktoberfest
ad|Andorra|Andorra-a-Velha|Europa|Pequeno país nos Pireneus, entre Espanha e França
ao|Angola|Luanda|África|Fala português e tem as Quedas de Kalandula
ag|Antígua e Barbuda|Saint John's|América Central e Caribe|Diz ter 365 praias, uma para cada dia do ano
sa|Arábia Saudita|Riad|Ásia|Meca, a cidade mais sagrada do islã
dz|Argélia|Argel|África|O maior país da África em área, com muito Saara
ar|Argentina|Buenos Aires|América do Sul|Tango, Messi e as Cataratas do Iguaçu
am|Armênia|Erevã|Ásia|Primeiro país a adotar o cristianismo oficialmente; vista do Monte Ararat
au|Austrália|Camberra|Oceania|Ópera de Sydney e cangurus
at|Áustria|Viena|Europa|Terra de Mozart, valsas e dos Alpes
az|Azerbaijão|Baku|Ásia|"Terra do fogo", com as Flame Towers no Mar Cáspio
bs|Bahamas|Nassau|América Central e Caribe|Arquipélago com porcos que nadam no mar
bh|Bahrein|Manama|Ásia|Arquipélago no Golfo Pérsico com circuito de Fórmula 1
bd|Bangladesh|Daca|Ásia|Delta do Ganges e os tigres de Bengala
bb|Barbados|Bridgetown|América Central e Caribe|Ilha do Caribe, terra natal da cantora Rihanna
by|Belarus|Minsk|Europa|Floresta de Białowieża, com bisões europeus
be|Bélgica|Bruxelas|Europa|Chocolates, waffles e a estátua Manneken Pis
bz|Belize|Belmopã|América Central e Caribe|Grande Buraco Azul e ruínas maias; fala inglês
bj|Benin|Porto Novo|África|Berço do vodu e das amazonas do antigo Reino de Daomé
bo|Bolívia|Sucre (e La Paz, sede do governo)|América do Sul|Salar de Uyuni, o maior deserto de sal do mundo
ba|Bósnia e Herzegovina|Sarajevo|Europa|A famosa ponte antiga de Mostar
bw|Botsuana|Gaborone|África|Delta do Okavango e muitos elefantes
br|Brasil|Brasília|América do Sul|Cristo Redentor e cinco títulos de Copa do Mundo
bn|Brunei|Bandar Seri Begawan|Ásia|Pequeno sultanato rico em petróleo na ilha de Bornéu
bg|Bulgária|Sófia|Europa|Vale das Rosas e o Mosteiro de Rila
bf|Burkina Faso|Uagadugu|África|Sedia o maior festival de cinema africano (FESPACO)
bi|Burundi|Gitega|África|Pequeno país às margens do lago Tanganica, famoso pelos tambores
bt|Butão|Timphu|Ásia|Mede a "Felicidade Interna Bruta"; mosteiro Ninho do Tigre
cv|Cabo Verde|Praia|África|Arquipélago que fala português, terra de Cesária Évora
cm|Camarões|Iaundé|África|Chamado de "África em miniatura", com vulcão ativo no litoral
kh|Camboja|Phnom Penh|Ásia|O templo de Angkor Wat aparece na bandeira
ca|Canadá|Ottawa|América do Norte|Cataratas do Niágara e a folha de bordo
qa|Catar|Doha|Ásia|Sediou a Copa do Mundo de 2022
kz|Cazaquistão|Astana|Ásia|Maior país sem saída para o mar; base espacial de Baikonur
td|Chade|N'Djamena|África|Um lago gigante que encolheu muito e parte do Saara
cl|Chile|Santiago|América do Sul|Ilha de Páscoa e o deserto do Atacama
cn|China|Pequim|Ásia|Grande Muralha e pandas
cy|Chipre|Nicósia|Europa|Ilha do Mediterrâneo onde, pela lenda, nasceu Afrodite
co|Colômbia|Bogotá|América do Sul|Café, Shakira e a cidade murada de Cartagena
km|Comores|Moroni|África|Arquipélago perfumado, grande produtor de ylang-ylang
cg|Congo|Brazzaville|África|A capital fica de frente para Kinshasa, do outro lado de um grande rio
cd|República Democrática do Congo|Kinshasa|África|Segunda maior floresta tropical do mundo, com gorilas e bonobos
kp|Coreia do Norte|Pyongyang|Ásia|Um dos países mais fechados do mundo
kr|Coreia do Sul|Seul|Ásia|K-pop, kimchi e Samsung
ci|Costa do Marfim|Yamoussoukro|África|Maior produtor de cacau do mundo
cr|Costa Rica|San José|América Central e Caribe|Aboliu o exército em 1948; "Pura vida"
hr|Croácia|Zagreb|Europa|Dubrovnik e o xadrez vermelho e branco
cu|Cuba|Havana|América Central e Caribe|Carros antigos, charutos e salsa
dk|Dinamarca|Copenhague|Europa|Terra do LEGO e da Pequena Sereia
dj|Djibuti|Djibuti|África|Lago Assal, um dos pontos mais baixos da África
dm|Dominica|Roseau|América Central e Caribe|"Ilha natureza", com um lago de água fervente
eg|Egito|Cairo|África|Pirâmides de Gizé e o rio Nilo
sv|El Salvador|San Salvador|América Central e Caribe|Menor país da América Central; pupusas
ae|Emirados Árabes Unidos|Abu Dhabi|Ásia|Burj Khalifa, o prédio mais alto do mundo, em Dubai
ec|Equador|Quito|América do Sul|Ilhas Galápagos e o monumento Metade do Mundo
er|Eritreia|Asmara|África|Capital com arquitetura art déco italiana
sk|Eslováquia|Bratislava|Europa|Montes Tatras e muitos castelos
si|Eslovênia|Liubliana|Europa|Lago Bled, com uma igrejinha numa ilha
es|Espanha|Madri|Europa|Sagrada Família, flamenco e touradas
us|Estados Unidos|Washington|América do Norte|Estátua da Liberdade e Hollywood
ee|Estônia|Tallinn|Europa|Pioneira digital: berço do Skype
sz|Essuatíni|Mbabane|África|Uma das últimas monarquias absolutas do mundo
et|Etiópia|Adis Abeba|África|Berço do café e igrejas escavadas na rocha em Lalibela
fj|Fiji|Suva|Oceania|Mais de 300 ilhas no Pacífico e ótimos times de rúgbi
ph|Filipinas|Manila|Ásia|Mais de 7 mil ilhas; Chocolate Hills
fi|Finlândia|Helsinque|Europa|Aldeia do Papai Noel, saunas e mil lagos
fr|França|Paris|Europa|Torre Eiffel, croissant e Museu do Louvre
ga|Gabão|Libreville|África|Florestas tropicais com gorilas e elefantes
gm|Gâmbia|Banjul|África|Menor país da África continental, ao longo de um rio
gh|Gana|Acra|África|Primeira colônia da África subsaariana a se tornar independente; cacau
ge|Geórgia|Tbilisi|Ásia|Uma das regiões vinícolas mais antigas do mundo; Montes Cáucaso
gd|Granada|Saint George's|América Central e Caribe|"Ilha das especiarias", famosa pela noz-moscada
gr|Grécia|Atenas|Europa|Acrópole, Partenon e as Olimpíadas antigas
gt|Guatemala|Cidade da Guatemala|América Central e Caribe|Pirâmides maias de Tikal e vulcões
gy|Guiana|Georgetown|América do Sul|Cataratas Kaieteur; único país sul-americano que fala inglês
gn|Guiné|Conacri|África|Chamado de "caixa d'água da África Ocidental"
gw|Guiné-Bissau|Bissau|África|Fala português; Arquipélago dos Bijagós
gq|Guiné Equatorial|Malabo|África|Único país africano com espanhol como língua oficial
ht|Haiti|Porto Príncipe|América Central e Caribe|Primeira república negra independente do mundo
hn|Honduras|Tegucigalpa|América Central e Caribe|Ruínas maias de Copán
hu|Hungria|Budapeste|Europa|Parlamento às margens do Danúbio; cubo mágico
ye|Iêmen|Sanaa|Ásia|Arranha-céus de barro em Shibam
in|Índia|Nova Délhi|Ásia|Taj Mahal, Bollywood e o rio Ganges
id|Indonésia|Jacarta|Ásia|Ilha de Bali e dragões-de-komodo
iq|Iraque|Bagdá|Ásia|Antiga Mesopotâmia, entre os rios Tigre e Eufrates
ir|Irã|Teerã|Ásia|Antiga Pérsia; ruínas de Persépolis
ie|Irlanda|Dublin|Europa|Trevo de três folhas e o Dia de São Patrício
is|Islândia|Reykjavik|Europa|Gêiseres, vulcões e auroras boreais
il|Israel|Jerusalém|Ásia|Mar Morto, onde se flutua facilmente
it|Itália|Roma|Europa|Coliseu, pizza e Torre de Pisa
jm|Jamaica|Kingston|América Central e Caribe|Bob Marley, reggae e Usain Bolt
jp|Japão|Tóquio|Ásia|Monte Fuji, sushi e trem-bala
jo|Jordânia|Amã|Ásia|A cidade de pedra de Petra
kw|Kuwait|Cidade do Kuwait|Ásia|Torres azuis à beira do Golfo Pérsico e muito petróleo
la|Laos|Vientiane|Ásia|Rio Mekong e a Planície dos Jarros
ls|Lesoto|Maseru|África|"Reino do céu": país inteiro acima de mil metros de altitude
lv|Letônia|Riga|Europa|Centro histórico art nouveau em Riga
lb|Líbano|Beirute|Ásia|A árvore cedro está na bandeira
lr|Libéria|Monróvia|África|Fundado por ex-escravizados dos Estados Unidos
ly|Líbia|Trípoli|África|Ruínas romanas de Leptis Magna e o Saara
li|Liechtenstein|Vaduz|Europa|Pequeno principado entre Suíça e Áustria
lt|Lituânia|Vilnius|Europa|Colina das Cruzes e muito basquete
lu|Luxemburgo|Luxemburgo|Europa|Um dos países mais ricos do mundo, cheio de castelos
mk|Macedônia do Norte|Escópia|Europa|Lago Ohrid, um dos mais antigos da Europa
mg|Madagascar|Antananarivo|África|Lêmures e a Avenida dos Baobás
my|Malásia|Kuala Lumpur|Ásia|Torres Petronas
mw|Malawi|Lilongwe|África|"Coração quente da África" e um lago enorme
mv|Maldivas|Malé|Ásia|Ilhas paradisíacas no Oceano Índico com bangalôs sobre o mar
ml|Mali|Bamako|África|Cidade lendária de Timbuktu e mesquita de barro de Djenné
mt|Malta|Valeta|Europa|Ilha do Mediterrâneo cheia de templos pré-históricos
ma|Marrocos|Rabat|África|Marrakech, Saara e a cidade azul de Chefchaouen
mh|Ilhas Marshall|Majuro|Oceania|Atóis no Pacífico, incluindo o de Biquíni
mu|Maurício|Port Louis|África|Ilha onde vivia o pássaro dodô
mr|Mauritânia|Nouakchott|África|O "Olho do Saara", estrutura gigante no deserto
mx|México|Cidade do México|América do Norte|Pirâmides de Teotihuacán, tacos e mariachis
fm|Micronésia|Palikir|Oceania|Ruínas de Nan Madol, cidade sobre recifes
mz|Moçambique|Maputo|África|Fala português; ilhas do Arquipélago de Bazaruto
md|Moldávia|Chisinau|Europa|Tem uma das maiores adegas de vinho do mundo
mc|Mônaco|Mônaco|Europa|Cassino de Monte Carlo e GP de Fórmula 1
mn|Mongólia|Ulan Bator|Ásia|Gengis Khan e o deserto de Gobi
me|Montenegro|Podgorica|Europa|Baía de Kotor no mar Adriático
mm|Mianmar|Naypyidaw|Ásia|Milhares de templos em Bagan
na|Namíbia|Windhoek|África|Dunas vermelhas de Sossusvlei
nr|Nauru|Yaren (sede do governo)|Oceania|Uma das menores repúblicas do mundo
np|Nepal|Katmandu|Ásia|Monte Everest; única bandeira nacional não retangular
ni|Nicarágua|Manágua|América Central e Caribe|"Terra de lagos e vulcões"
ne|Níger|Niamey|África|Deserto do Ténéré e girafas do oeste africano
ng|Nigéria|Abuja|África|País mais populoso da África; Nollywood
no|Noruega|Oslo|Europa|Fiordes, sol da meia-noite e vikings
nz|Nova Zelândia|Wellington|Oceania|Cenários de O Senhor dos Anéis e o pássaro kiwi
om|Omã|Mascate|Ásia|Fortes antigos e o deserto de Wahiba
nl|Países Baixos|Amsterdã|Europa|Tulipas, moinhos de vento e bicicletas
pw|Palau|Ngerulmud|Oceania|Lago com milhões de águas-vivas que não queimam
pa|Panamá|Cidade do Panamá|América Central e Caribe|O canal que liga o Atlântico ao Pacífico
pg|Papua-Nova Guiné|Port Moresby|Oceania|Mais de 800 línguas faladas; aves-do-paraíso
pk|Paquistão|Islamabad|Ásia|K2, a segunda montanha mais alta do mundo
py|Paraguai|Assunção|América do Sul|Usina de Itaipu (com o Brasil) e o idioma guarani
pe|Peru|Lima|América do Sul|Machu Picchu e as lhamas
pl|Polônia|Varsóvia|Europa|Terra de Chopin e da cientista Marie Curie
pt|Portugal|Lisboa|Europa|Torre de Belém, pastel de nata e Cristiano Ronaldo
ke|Quênia|Nairóbi|África|Safáris no Masai Mara e grandes maratonistas
kg|Quirguistão|Bishkek|Ásia|Lago Issyk-Kul e iurtas nômades
gb|Reino Unido|Londres|Europa|Big Ben, Família Real e chá das cinco
cf|República Centro-Africana|Bangui|África|Fica bem no centro do continente
cz|República Tcheca|Praga|Europa|Ponte Carlos e o relógio astronômico de Praga
do|República Dominicana|Santo Domingo|América Central e Caribe|Punta Cana e merengue
ro|Romênia|Bucareste|Europa|Castelo de Bran, ligado à lenda do Drácula
rw|Ruanda|Kigali|África|"Terra das mil colinas" e gorilas-das-montanhas
ru|Rússia|Moscou|Europa|Maior país do mundo; Praça Vermelha e Kremlin
ws|Samoa|Apia|Oceania|Ilhas do Pacífico Sul famosas pelas tatuagens tradicionais
sm|San Marino|San Marino|Europa|Uma das repúblicas mais antigas do mundo, dentro da Itália
lc|Santa Lúcia|Castries|América Central e Caribe|Os picos vulcânicos gêmeos Pitons
kn|São Cristóvão e Névis|Basseterre|América Central e Caribe|Menor país das Américas
st|São Tomé e Príncipe|São Tomé|África|Fala português; ilhas na linha do equador
vc|São Vicente e Granadinas|Kingstown|América Central e Caribe|Locação de Piratas do Caribe
sn|Senegal|Dacar|África|Lago Rosa e a antiga chegada do Rali Dakar
sl|Serra Leoa|Freetown|África|Famosa pelos diamantes e praias tropicais
rs|Sérvia|Belgrado|Europa|Terra de Novak Djokovic e de Nikola Tesla
sc|Seicheles|Victoria|África|Ilhas com o coco-do-mar, a maior semente do mundo
sg|Singapura|Singapura|Ásia|Cidade-Estado com o hotel Marina Bay Sands e o Merlion
sy|Síria|Damasco|Ásia|Damasco, uma das cidades mais antigas habitadas do mundo
so|Somália|Mogadíscio|África|Tem o litoral mais longo da África continental
lk|Sri Lanka|Colombo (Sri Jayawardenepura Kotte, oficial)|Ásia|Chá do Ceilão e a rocha de Sigiriya
sd|Sudão|Cartum|África|Tem mais pirâmides que o Egito (Meroé)
ss|Sudão do Sul|Juba|África|O país mais novo do mundo (2011)
se|Suécia|Estocolmo|Europa|ABBA, IKEA e o Prêmio Nobel
ch|Suíça|Berna|Europa|Relógios, chocolate, queijo e os Alpes
sr|Suriname|Paramaribo|América do Sul|Único país da América do Sul que fala holandês
tj|Tajiquistão|Duchambé|Ásia|Montanhas do Pamir, o "teto do mundo"
th|Tailândia|Bangkok|Ásia|Templos budistas, elefantes e pad thai
tw|Taiwan|Taipé|Ásia|Arranha-céu Taipei 101 e o chá de bolhas
tz|Tanzânia|Dodoma|África|Monte Kilimanjaro e a ilha de Zanzibar
tl|Timor-Leste|Díli|Ásia|Fala português; independente desde 2002
tg|Togo|Lomé|África|Faixa estreita de terra no Golfo da Guiné
to|Tonga|Nuku'alofa|Oceania|Último reino da Polinésia
tt|Trinidad e Tobago|Port of Spain|América Central e Caribe|Berço do steelpan e um grande carnaval
tn|Tunísia|Túnis|África|Ruínas de Cartago e cenários de Star Wars
tm|Turcomenistão|Asgabate|Ásia|"Porta do Inferno", cratera de gás em chamas
tr|Turquia|Ancara|Ásia|Istambul, Capadócia e balões ao amanhecer
tv|Tuvalu|Funafuti|Oceania|Ilhas tão baixas que podem sumir com a subida do mar
ua|Ucrânia|Kiev|Europa|Campos de girassol e a cidade de Chernobyl
ug|Uganda|Kampala|África|Nascentes do Nilo e gorilas-das-montanhas
uy|Uruguai|Montevidéu|América do Sul|Primeiro campeão da Copa do Mundo (1930); chimarrão
uz|Uzbequistão|Tashkent|Ásia|Samarcanda, na antiga Rota da Seda
vu|Vanuatu|Port Vila|Oceania|Vulcão ativo onde se pode olhar a lava de perto
va|Vaticano|Cidade do Vaticano|Europa|Menor país do mundo; morada do papa
ve|Venezuela|Caracas|América do Sul|Salto Ángel, a cachoeira mais alta do mundo
vn|Vietnã|Hanói|Ásia|Baía de Ha Long e o pho
zm|Zâmbia|Lusaka|África|Cataratas Vitória (com o Zimbábue)
zw|Zimbábue|Harare|África|Ruínas de pedra de uma cidade medieval e as Cataratas Vitória
sb|Ilhas Salomão|Honiara|Oceania|Palco de grandes batalhas da Segunda Guerra no Pacífico
ki|Kiribati|Tarawa do Sul|Oceania|Primeiro país a ver o Ano-Novo
ps|Palestina|Ramallah (sede administrativa)|Ásia|Belém, cidade onde nasceu Jesus
xk|Kosovo|Pristina|Europa|Um dos países mais jovens da Europa (2008)
pr|Porto Rico|San Juan|América Central e Caribe|Terra do reggaeton e de "Despacito"
gl|Groenlândia|Nuuk|América do Norte|A maior ilha do mundo, coberta de gelo
hk|Hong Kong|Hong Kong|Ásia|Arranha-céus no porto Victoria e dim sum
`;
const LISTA = DADOS.trim().split('\n').map(l => {
  const [code, nome, capital, continente, curiosidade] = l.split('|');
  return { code, nome, capital, continente, curiosidade };
});
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const API = { lista: LISTA, norm, porCodigo: Object.fromEntries(LISTA.map(p => [p.code, p])) };
if (typeof module === 'object' && module.exports) module.exports = API; else root.PAISES = API;
})(this);
