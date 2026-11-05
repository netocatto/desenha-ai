// Banco de palavras por categoria. Adicione ou remova à vontade.
// (Abra no Bloco de Notas, mantenha as aspas e vírgulas.)
(function (root) {
const PALAVRAS = {
  objetos: {
    nome: 'Objetos',
    palavras: ['Guarda-chuva', 'Tesoura', 'Óculos', 'Relógio', 'Chave', 'Vela', 'Escova de dente', 'Cadeira',
      'Lâmpada', 'Mochila', 'Garrafa', 'Martelo', 'Celular', 'Televisão', 'Bicicleta', 'Escada', 'Travesseiro',
      'Ventilador', 'Geladeira', 'Violão', 'Livro', 'Caneca', 'Chapéu', 'Sapato', 'Espelho', 'Cadeado',
      'Pente', 'Controle remoto', 'Balde', 'Vassoura', 'Microfone', 'Câmera', 'Ferro de passar', 'Âncora']
  },
  animais: {
    nome: 'Animais',
    palavras: ['Girafa', 'Elefante', 'Cobra', 'Tartaruga', 'Polvo', 'Coruja', 'Pinguim', 'Jacaré', 'Borboleta',
      'Aranha', 'Caracol', 'Tubarão', 'Macaco', 'Cavalo', 'Galinha', 'Porco', 'Coelho', 'Leão', 'Zebra',
      'Baleia', 'Formiga', 'Abelha', 'Morcego', 'Papagaio', 'Sapo', 'Camelo', 'Canguru', 'Caranguejo',
      'Vaca', 'Peixe', 'Pato', 'Tatu', 'Capivara', 'Tamanduá']
  },
  acoes: {
    nome: 'Ações',
    palavras: ['Dormir', 'Nadar', 'Pescar', 'Dançar', 'Correr', 'Cozinhar', 'Pular corda', 'Escovar os dentes',
      'Tomar banho', 'Chorar', 'Espirrar', 'Dirigir', 'Voar', 'Cantar', 'Tirar foto', 'Pintar', 'Plantar',
      'Ler', 'Escalar', 'Surfar', 'Andar de bicicleta', 'Lavar louça', 'Abraçar', 'Bocejar', 'Varrer',
      'Fazer churrasco', 'Empinar pipa', 'Tocar bateria', 'Jogar bola', 'Mergulhar', 'Roncar', 'Piscar']
  },
  comidas: {
    nome: 'Comidas',
    palavras: ['Pizza', 'Hambúrguer', 'Sorvete', 'Coxinha', 'Pastel', 'Brigadeiro', 'Melancia', 'Banana',
      'Abacaxi', 'Pipoca', 'Ovo frito', 'Bolo de aniversário', 'Cachorro-quente', 'Pão de queijo', 'Uva',
      'Cenoura', 'Milho', 'Sushi', 'Espaguete', 'Feijoada', 'Pudim', 'Churrasco', 'Queijo', 'Tomate',
      'Morango', 'Café', 'Picolé', 'Batata frita', 'Coco', 'Rosquinha', 'Maçã', 'Pera']
  },
  profissoes: {
    nome: 'Profissões',
    palavras: ['Bombeiro', 'Médico', 'Astronauta', 'Pedreiro', 'Eletricista', 'Professor', 'Cozinheiro',
      'Policial', 'Pintor', 'Dentista', 'Palhaço', 'Mágico', 'Pescador', 'Piloto', 'Carteiro', 'Fazendeiro',
      'Jogador de futebol', 'Cabeleireiro', 'Mecânico', 'Enfermeira', 'Engenheiro', 'Juiz', 'Garçom',
      'Fotógrafo', 'Salva-vidas', 'Detetive', 'Cantor', 'Padeiro']
  },
  lugares: {
    nome: 'Lugares',
    palavras: ['Praia', 'Hospital', 'Escola', 'Igreja', 'Farmácia', 'Castelo', 'Ilha', 'Deserto', 'Floresta',
      'Vulcão', 'Cinema', 'Aeroporto', 'Estádio', 'Zoológico', 'Supermercado', 'Biblioteca', 'Fazenda',
      'Montanha', 'Cachoeira', 'Circo', 'Parque de diversões', 'Padaria', 'Piscina', 'Prisão', 'Banheiro',
      'Cozinha', 'Posto de gasolina', 'Rodoviária']
  },
  esportes: {
    nome: 'Esportes',
    palavras: ['Futebol', 'Basquete', 'Vôlei', 'Tênis', 'Natação', 'Boxe', 'Skate', 'Surfe', 'Ciclismo',
      'Golfe', 'Boliche', 'Judô', 'Corrida', 'Esqui', 'Pingue-pongue', 'Arco e flecha', 'Paraquedismo',
      'Hipismo', 'Xadrez', 'Handebol', 'Beisebol', 'Patinação', 'Levantamento de peso', 'Capoeira']
  },
  natureza: {
    nome: 'Natureza',
    palavras: ['Sol', 'Lua', 'Arco-íris', 'Nuvem', 'Raio', 'Chuva', 'Neve', 'Árvore', 'Flor', 'Cacto',
      'Rio', 'Estrela', 'Tornado', 'Onda', 'Folha', 'Cogumelo', 'Pedra', 'Fogo', 'Planeta', 'Cometa',
      'Coqueiro', 'Girassol', 'Terremoto', 'Lago', 'Caverna', 'Pôr do sol']
  },
  transportes: {
    nome: 'Transportes',
    palavras: ['Avião', 'Helicóptero', 'Navio', 'Trem', 'Ônibus', 'Moto', 'Caminhão', 'Foguete', 'Submarino',
      'Barco a vela', 'Balão', 'Ambulância', 'Carro de bombeiro', 'Trator', 'Patinete', 'Carroça',
      'Teleférico', 'Metrô', 'Canoa', 'Táxi', 'Jet ski', 'Disco voador']
  }
};
if (typeof module === 'object' && module.exports) module.exports = PALAVRAS; else root.PALAVRAS = PALAVRAS;
})(this);
