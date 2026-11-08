// Banco de palavras por categoria. Adicione ou remova à vontade.
// (Abra no Bloco de Notas, mantenha as aspas e vírgulas.)
(function (root) {
const PALAVRAS = {
  objetos: {
    nome: 'Objetos',
    palavras: ['Guarda-chuva', 'Tesoura', 'Óculos', 'Relógio', 'Chave', 'Vela', 'Escova de dente', 'Cadeira', 'Lâmpada', 'Mochila', 'Garrafa', 'Martelo', 'Celular', 'Televisão', 'Bicicleta', 'Escada', 'Travesseiro', 'Ventilador', 'Geladeira', 'Violão', 'Livro', 'Caneca', 'Chapéu', 'Sapato', 'Espelho', 'Cadeado', 'Pente', 'Controle remoto', 'Balde', 'Vassoura', 'Microfone', 'Câmera', 'Ferro de passar', 'Âncora', 'Abajur', 'Agulha', 'Alicate', 'Apito', 'Ampulheta', 'Bússola', 'Binóculo', 'Bola de cristal', 'Borracha', 'Cabide', 'Calculadora', 'Carimbo', 'Cesta', 'Chaleira', 'Chupeta', 'Cofre', 'Colher', 'Computador', 'Envelope', 'Esponja', 'Estetoscópio', 'Extintor', 'Faca', 'Fone de ouvido', 'Fósforo', 'Funil', 'Garfo', 'Grampeador', 'Lanterna', 'Lápis', 'Liquidificador', 'Lupa', 'Mala', 'Mamadeira', 'Megafone', 'Panela', 'Paraquedas', 'Pá', 'Pincel', 'Pipa', 'Prego', 'Régua', 'Rede de dormir', 'Sabonete', 'Secador de cabelo', 'Serrote', 'Telescópio', 'Termômetro', 'Tijolo', 'Torneira', 'Trena', 'Vaso', 'Xícara', 'Ímã']
  },
  animais: {
    nome: 'Animais',
    palavras: ['Girafa', 'Elefante', 'Cobra', 'Tartaruga', 'Polvo', 'Coruja', 'Pinguim', 'Jacaré', 'Borboleta', 'Aranha', 'Caracol', 'Tubarão', 'Macaco', 'Cavalo', 'Galinha', 'Porco', 'Coelho', 'Leão', 'Zebra', 'Baleia', 'Formiga', 'Abelha', 'Morcego', 'Papagaio', 'Sapo', 'Camelo', 'Canguru', 'Caranguejo', 'Vaca', 'Peixe', 'Pato', 'Tatu', 'Capivara', 'Tamanduá', 'Avestruz', 'Baleia-azul', 'Barata', 'Beija-flor', 'Besouro', 'Bicho-preguiça', 'Boto-cor-de-rosa', 'Búfalo', 'Cabra', 'Camaleão', 'Caranguejo-ermitão', 'Cavalo-marinho', 'Centopeia', 'Cisne', 'Coala', 'Cobra-coral', 'Esquilo', 'Estrela-do-mar', 'Flamingo', 'Foca', 'Gafanhoto', 'Gato', 'Golfinho', 'Gorila', 'Hipopótamo', 'Joaninha', 'Lagosta', 'Lobo', 'Lula', 'Mico-leão-dourado', 'Minhoca', 'Mosquito', 'Ovelha', 'Panda', 'Pavão', 'Pelicano', 'Porco-espinho', 'Raposa', 'Rinoceronte', 'Sapo-boi', 'Tigre', 'Tucano', 'Urso-polar', 'Urubu', 'Vagalume', 'Zebra-listrada']
  },
  acoes: {
    nome: 'Ações',
    palavras: ['Dormir', 'Nadar', 'Pescar', 'Dançar', 'Correr', 'Cozinhar', 'Pular corda', 'Escovar os dentes', 'Tomar banho', 'Chorar', 'Espirrar', 'Dirigir', 'Voar', 'Cantar', 'Tirar foto', 'Pintar', 'Plantar', 'Ler', 'Escalar', 'Surfar', 'Andar de bicicleta', 'Lavar louça', 'Abraçar', 'Bocejar', 'Varrer', 'Fazer churrasco', 'Empinar pipa', 'Tocar bateria', 'Jogar bola', 'Mergulhar', 'Roncar', 'Piscar', 'Acordar', 'Amarrar o sapato', 'Andar de skate', 'Aplaudir', 'Assobiar', 'Beber água', 'Brindar', 'Cair', 'Carregar', 'Cavar', 'Chutar', 'Colar', 'Comer pipoca', 'Contar dinheiro', 'Cortar cabelo', 'Costurar', 'Desenhar', 'Digitar', 'Empurrar', 'Escrever', 'Fazer careta', 'Fazer yoga', 'Gritar', 'Jogar videogame', 'Lavar roupa', 'Levantar peso', 'Malabarismo', 'Meditar', 'Mergulhar de cabeça', 'Nadar de costas', 'Patinar', 'Pentear', 'Pescar de rede', 'Pular de paraquedas', 'Rir', 'Saltar', 'Sonhar', 'Tocar violão', 'Tomar sorvete', 'Tropeçar', 'Votar', 'Pedalar', 'Cochilar', 'Remar']
  },
  comidas: {
    nome: 'Comidas',
    palavras: ['Pizza', 'Hambúrguer', 'Sorvete', 'Coxinha', 'Pastel', 'Brigadeiro', 'Melancia', 'Banana', 'Abacaxi', 'Pipoca', 'Ovo frito', 'Bolo de aniversário', 'Cachorro-quente', 'Pão de queijo', 'Uva', 'Cenoura', 'Milho', 'Sushi', 'Espaguete', 'Feijoada', 'Pudim', 'Churrasco', 'Queijo', 'Tomate', 'Morango', 'Café', 'Picolé', 'Batata frita', 'Coco', 'Rosquinha', 'Maçã', 'Pera', 'Abacate', 'Açaí', 'Alface', 'Arroz', 'Bacon', 'Baguete', 'Banana-split', 'Batata', 'Biscoito', 'Bolo de chocolate', 'Brócolis', 'Camarão', 'Carambola', 'Castanha', 'Cereja', 'Churros', 'Coco ralado', 'Cookie', 'Croissant', 'Cupcake', 'Esfiha', 'Farofa', 'Feijão', 'Frango assado', 'Gelatina', 'Kiwi', 'Laranja', 'Lasanha', 'Limão', 'Macarrão', 'Manga', 'Melão', 'Mexerica', 'Milk-shake', 'Omelete', 'Pamonha', 'Panqueca', 'Pão francês', 'Pepino', 'Picanha', 'Pimenta', 'Pirulito', 'Pizza de calabresa', 'Quindim', 'Salada', 'Sanduíche', 'Sopa', 'Tapioca', 'Torta', 'Waffle']
  },
  profissoes: {
    nome: 'Profissões',
    palavras: ['Bombeiro', 'Médico', 'Astronauta', 'Pedreiro', 'Eletricista', 'Professor', 'Cozinheiro', 'Policial', 'Pintor', 'Dentista', 'Palhaço', 'Mágico', 'Pescador', 'Piloto', 'Carteiro', 'Fazendeiro', 'Jogador de futebol', 'Cabeleireiro', 'Mecânico', 'Enfermeira', 'Engenheiro', 'Juiz', 'Garçom', 'Fotógrafo', 'Salva-vidas', 'Detetive', 'Cantor', 'Padeiro', 'Advogado', 'Agricultor', 'Arqueólogo', 'Arquiteto', 'Ator', 'Bailarina', 'Barbeiro', 'Bibliotecário', 'Cientista', 'Costureira', 'Dentista infantil', 'DJ', 'Encanador', 'Escritor', 'Faxineiro', 'Florista', 'Frentista', 'Goleiro', 'Guarda de trânsito', 'Jardineiro', 'Jornalista', 'Lutador', 'Maestro', 'Marinheiro', 'Motorista de ônibus', 'Músico', 'Nutricionista', 'Pediatra', 'Pintor de paredes', 'Pirata', 'Programador', 'Psicólogo', 'Repórter', 'Sapateiro', 'Soldado', 'Surfista', 'Taxista', 'Veterinário', 'Youtuber', 'Zelador']
  },
  lugares: {
    nome: 'Lugares',
    palavras: ['Praia', 'Hospital', 'Escola', 'Igreja', 'Farmácia', 'Castelo', 'Ilha', 'Deserto', 'Floresta', 'Vulcão', 'Cinema', 'Aeroporto', 'Estádio', 'Zoológico', 'Supermercado', 'Biblioteca', 'Fazenda', 'Montanha', 'Cachoeira', 'Circo', 'Parque de diversões', 'Padaria', 'Piscina', 'Prisão', 'Banheiro', 'Cozinha', 'Posto de gasolina', 'Rodoviária', 'Academia', 'Aquário', 'Banco', 'Barbearia', 'Cemitério', 'Cidade', 'Clube', 'Consultório', 'Deserto do Saara', 'Escritório', 'Estação de trem', 'Farol', 'Feira', 'Floresta Amazônica', 'Garagem', 'Hotel', 'Jardim', 'Lanchonete', 'Lavanderia', 'Mercado', 'Museu', 'Oficina', 'Palco', 'Pântano', 'Parque', 'Polo Norte', 'Ponte', 'Porto', 'Restaurante', 'Shopping', 'Sítio', 'Sorveteria', 'Teatro', 'Torre', 'Túnel', 'Universidade', 'Zoológico de noite']
  },
  esportes: {
    nome: 'Esportes',
    palavras: ['Futebol', 'Basquete', 'Vôlei', 'Tênis', 'Natação', 'Boxe', 'Skate', 'Surfe', 'Ciclismo', 'Golfe', 'Boliche', 'Judô', 'Corrida', 'Esqui', 'Pingue-pongue', 'Arco e flecha', 'Paraquedismo', 'Hipismo', 'Xadrez', 'Handebol', 'Beisebol', 'Patinação', 'Levantamento de peso', 'Capoeira', 'Atletismo', 'Badminton', 'Basquete de rua', 'Bocha', 'Canoagem', 'Escalada', 'Esgrima', 'Futsal', 'Futebol americano', 'Ginástica artística', 'Minigolfe', 'Hóquei no gelo', 'Jiu-jítsu', 'Karatê', 'Kitesurfe', 'Lançamento de dardo', 'Maratona', 'Motocross', 'Polo aquático', 'Remo', 'Rúgbi', 'Salto com vara', 'Salto ornamental', 'Sinuca', 'Snowboard', 'Sumô', 'Taekwondo', 'Tênis de mesa', 'Tiro com arco', 'Triatlo', 'Vôlei de praia', 'Xadrez gigante']
  },
  natureza: {
    nome: 'Natureza',
    palavras: ['Sol', 'Lua', 'Arco-íris', 'Nuvem', 'Raio', 'Chuva', 'Neve', 'Árvore', 'Flor', 'Cacto', 'Rio', 'Estrela', 'Tornado', 'Onda', 'Folha', 'Cogumelo', 'Pedra', 'Fogo', 'Planeta', 'Cometa', 'Coqueiro', 'Girassol', 'Terremoto', 'Lago', 'Caverna', 'Pôr do sol', 'Areia', 'Bambu', 'Cachoeira gigante', 'Chuva de granizo', 'Duna', 'Eclipse', 'Floco de neve', 'Galáxia', 'Geleira', 'Gota de água', 'Grama', 'Iceberg', 'Ilha deserta', 'Lua cheia', 'Meteoro', 'Montanha nevada', 'Musgo', 'Neblina', 'Oásis', 'Orvalho', 'Palmeira', 'Pinheiro', 'Raiz', 'Recife de coral', 'Rosa', 'Semente', 'Tempestade', 'Tronco', 'Trovão', 'Tulipa', 'Vento', 'Vulcão em erupção']
  },
  transportes: {
    nome: 'Transportes',
    palavras: ['Avião', 'Helicóptero', 'Navio', 'Trem', 'Ônibus', 'Moto', 'Caminhão', 'Foguete', 'Submarino', 'Barco a vela', 'Balão', 'Ambulância', 'Carro de bombeiro', 'Trator', 'Patinete', 'Carroça', 'Teleférico', 'Metrô', 'Canoa', 'Táxi', 'Jet ski', 'Disco voador', 'Avião de papel', 'Bicicleta elétrica', 'Bonde', 'Caiaque', 'Carro de corrida', 'Carrinho de mão', 'Carruagem', 'Charrete', 'Dirigível', 'Escada rolante', 'Elevador', 'Jangada', 'Lancha', 'Limusine', 'Monociclo', 'Navio pirata', 'Ônibus escolar', 'Paraglider', 'Patins', 'Planador', 'Quadriciclo', 'Riquixá', 'Tanque de guerra', 'Trem-bala', 'Triciclo', 'Van', 'Viatura de polícia', 'Zeppelin', 'Hidroavião']
  },
  natal: {
    nome: 'Natal 🎅',
    palavras: ['Árvore', 'Peru', 'Papai Noel', 'Trenó', 'Rena', 'Presente', 'Ceia', 'Pisca Pisca', 'Árvore de Natal', 'Bota de Natal', 'Boneco de neve', 'Estrela de Natal', 'Guirlanda', 'Meia de Natal', 'Presépio', 'Sino', 'Bengala doce', 'Panetone', 'Peru de Natal', 'Duende']
  },
  instrumentos: {
    nome: 'Instrumentos musicais',
    palavras: ['Acordeão', 'Bateria', 'Berimbau', 'Cavaquinho', 'Clarinete', 'Contrabaixo', 'Flauta', 'Gaita', 'Guitarra', 'Harpa', 'Pandeiro', 'Piano', 'Saxofone', 'Tambor', 'Teclado', 'Triângulo', 'Trombone', 'Trompete', 'Ukulele', 'Violino', 'Xilofone', 'Cuíca', 'Sanfona', 'Chocalho']
  },
  corpo: {
    nome: 'Corpo humano',
    palavras: ['Barba', 'Bigode', 'Boca', 'Cabelo', 'Cérebro', 'Coração', 'Costas', 'Cotovelo', 'Dente', 'Dedo', 'Esqueleto', 'Joelho', 'Língua', 'Mão', 'Nariz', 'Olho', 'Orelha', 'Ombro', 'Pé', 'Pescoço', 'Pulmão', 'Sobrancelha', 'Unha', 'Umbigo']
  },
  roupas: {
    nome: 'Roupas e acessórios',
    palavras: ['Anel', 'Avental', 'Bermuda', 'Biquíni', 'Boné', 'Bota', 'Brinco', 'Cachecol', 'Camisa', 'Capa de chuva', 'Chinelo', 'Coroa', 'Gravata', 'Jaqueta', 'Luva', 'Meia', 'Pijama', 'Pulseira', 'Saia', 'Sunga', 'Touca', 'Vestido', 'Relógio de pulso', 'Óculos de sol']
  },
  brinquedos: {
    nome: 'Brinquedos e jogos',
    palavras: ['Amarelinha', 'Balanço', 'Bambolê', 'Bola de gude', 'Boneca', 'Cabo de guerra', 'Carrinho', 'Cata-vento', 'Dominó', 'Escorregador', 'Esconde-esconde', 'Gangorra', 'Ioiô', 'Lego', 'Pião', 'Pula-pula', 'Quebra-cabeça', 'Robô de brinquedo', 'Ursinho de pelúcia', 'Videogame', 'Dado', 'Baralho', 'Peteca', 'Massinha']
  },
  fantasia: {
    nome: 'Fantasia e monstros',
    palavras: ['Alienígena', 'Anjo', 'Bruxa', 'Centauro', 'Ciclope', 'Dinossauro', 'Dragão', 'Fada', 'Fantasma', 'Gigante', 'Lobisomem', 'Múmia', 'Ogro', 'Pégaso', 'Robô gigante', 'Sereia', 'Unicórnio', 'Vampiro', 'Zumbi', 'Caveira', 'Mago', 'Gênio da lâmpada', 'Saci-pererê', 'Curupira', 'Mula sem cabeça', 'Boitatá', 'Iara']
  }
};
if (typeof module === 'object' && module.exports) module.exports = PALAVRAS; else root.PALAVRAS = PALAVRAS;
})(this);
