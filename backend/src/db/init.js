import pool from "./pool.js";
import bcrypt from "bcrypt";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

export async function initDatabase({ closePool = true } = {}) {
  const client = await pool.connect();

  try {
    console.log("🔧 Iniciando criação das tabelas...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS generos (
        id          SERIAL PRIMARY KEY,
        nome        VARCHAR(100) NOT NULL UNIQUE,
        cor         VARCHAR(20)  NOT NULL DEFAULT '#c08928',
        descricao   TEXT,
        criado_em   TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS autores (
        id                 SERIAL PRIMARY KEY,
        nome               VARCHAR(255) NOT NULL,
        ano_nascimento     INTEGER,
        nacionalidade      VARCHAR(100),
        descricao          TEXT,
        principais_generos JSONB DEFAULT '[]',
        criado_em          TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS livros (
        id            SERIAL PRIMARY KEY,
        titulo        VARCHAR(255) NOT NULL,
        autor         VARCHAR(255) NOT NULL,
        nacionalidade VARCHAR(100),
        editora       VARCHAR(150),
        ano           INTEGER,
        sinopse       TEXT,
        exemplares    INTEGER NOT NULL DEFAULT 1,
        isbn          VARCHAR(30),
        genero        VARCHAR(100),
        criado_em     TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bibliotecarios (
        id            SERIAL PRIMARY KEY,
        nome          VARCHAR(255) NOT NULL,
        cpf           VARCHAR(20)  UNIQUE,
        login         VARCHAR(100) NOT NULL UNIQUE,
        senha_hash    TEXT         NOT NULL,
        criado_em     TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leitores (
        id               SERIAL PRIMARY KEY,
        nome             VARCHAR(255) NOT NULL,
        cpf              VARCHAR(20)  UNIQUE,
        login            VARCHAR(100) NOT NULL UNIQUE,
        senha_hash       TEXT         NOT NULL,
        data_registro    DATE         DEFAULT CURRENT_DATE,
        criado_em        TIMESTAMP    DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS estante (
        id            SERIAL PRIMARY KEY,
        usuario_id    INTEGER NOT NULL,
        usuario_tipo  VARCHAR(20) NOT NULL DEFAULT 'leitor',
        livro_id      INTEGER NOT NULL REFERENCES livros(id) ON DELETE CASCADE,
        status        VARCHAR(50) NOT NULL DEFAULT 'Pretendo Ler',
        is_favorito   BOOLEAN NOT NULL DEFAULT FALSE,
        adicionado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(usuario_tipo, usuario_id, livro_id)
      );
    `);

    await client.query(`
      ALTER TABLE livros ADD COLUMN IF NOT EXISTS sinopse TEXT;
      ALTER TABLE estante ADD COLUMN IF NOT EXISTS is_favorito BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE estante ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Pretendo Ler';
      ALTER TABLE estante ALTER COLUMN usuario_id SET NOT NULL;
      ALTER TABLE estante ALTER COLUMN usuario_tipo SET NOT NULL;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS estante_usuario_uniq
      ON estante (usuario_tipo, usuario_id, livro_id);
    `);

    console.log("✅ Tabelas criadas.");

    // ── Seed: Gêneros ──────────────────────────────────────────────
    const generosExistentes = await client.query("SELECT COUNT(*) FROM generos");
    if (parseInt(generosExistentes.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO generos (nome, cor, descricao) VALUES
          ('Clássico',          '#c7922d', 'Obras atemporais que marcaram gerações e moldaram a história da literatura mundial.'),
          ('Romance',           '#2d5c4e', 'Histórias centradas em relações humanas, sentimentos profundos e conflitos emocionais.'),
          ('Ficção Científica', '#2e6b9e', 'Narrativas especulativas que exploram ciência, tecnologia e futuros possíveis.'),
          ('Fantasia',          '#7a5a92', 'Mundos imaginários repletos de magia, criaturas míticas e aventuras épicas.'),
          ('Distopia',          '#4a4a6a', 'Sociedades fictícias opressivas que refletem medos e críticas ao mundo contemporâneo.'),
          ('Mistério',          '#5c3d2e', 'Tramas envolventes com enigmas, investigações e reviravoltas inesperadas.'),
          ('Terror',            '#3b1a1a', 'Narrativas perturbadoras que exploram o medo, o sobrenatural e o desconhecido.'),
          ('Aventura',          '#4a7c3f', 'Jornadas emocionantes repletas de ação, descobertas e superação de obstáculos.'),
          ('Realismo',          '#8c7b5a', 'Retratos fiéis da sociedade e do cotidiano humano com profundidade psicológica.'),
          ('Poesia',            '#8c3a6b', 'Expressão artística da linguagem que explora emoções, imagens e ritmos.'),
          ('Biografia',         '#3a6b8c', 'Relatos da vida de pessoas reais que marcaram a história e a cultura.'),
          ('Filosofia',         '#5a6b3a', 'Reflexões sobre a existência, o conhecimento, a ética e a natureza humana.'),
          ('Policial',          '#3a4a5a', 'Histórias de crimes, detetives e investigações que prendem o leitor até a última página.'),
          ('Histórico',         '#7a5a3a', 'Narrativas ambientadas em períodos históricos que combinam fatos e ficção com precisão.'),
          ('Infantojuvenil',    '#c85a2e', 'Histórias encantadoras e formativas voltadas para crianças e jovens leitores.')
        ON CONFLICT (nome) DO NOTHING;
      `);
      console.log("✅ Gêneros inseridos.");
    }

    // ── Seed: Autores ──────────────────────────────────────────────
    const autoresExistentes = await client.query("SELECT COUNT(*) FROM autores");
    if (parseInt(autoresExistentes.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO autores (nome, ano_nascimento, nacionalidade, descricao, principais_generos) VALUES
          ('Miguel de Cervantes',    1547, 'Espanhol',    'Autor de Dom Quixote, considerado o maior escritor da língua espanhola e pai do romance moderno.',                             '["Clássico", "Aventura"]'),
          ('Aluísio Azevedo',        1857, 'Brasileiro',  'Pioneiro do naturalismo no Brasil, conhecido por retratos crus e precisos da sociedade do século XIX.',                         '["Realismo", "Clássico"]'),
          ('George Orwell',          1903, 'Britânico',   'Escritor e jornalista britânico célebre por suas distopias políticas e críticas ao totalitarismo.',                             '["Distopia", "Ficção Científica"]'),
          ('João Guimarães Rosa',    1908, 'Brasileiro',  'Mestre do regionalismo e da inovação linguística, autor de uma das maiores obras da literatura brasileira.',                    '["Realismo", "Clássico"]'),
          ('J.K. Rowling',           1965, 'Britânica',   'Criadora do universo de Harry Potter, um dos maiores fenômenos editoriais da história.',                                        '["Fantasia", "Infantojuvenil"]'),
          ('Franz Kafka',            1883, 'Tcheco',      'Um dos escritores mais influentes do século XX, conhecido pelo absurdo existencial e pela crítica às estruturas de poder.',     '["Clássico", "Filosofia"]'),
          ('Agatha Christie',        1890, 'Britânica',   'A rainha do crime, autora mais vendida da história depois da Bíblia, criadora de Hercule Poirot e Miss Marple.',               '["Policial", "Mistério"]'),
          ('Gabriel García Márquez', 1927, 'Colombiano',  'Nobel de Literatura e pai do realismo mágico, sua obra mistura realidade e fantasia com maestria única.',                      '["Clássico", "Histórico"]'),
          ('J.R.R. Tolkien',         1892, 'Britânico',   'Professor de Oxford e criador do universo Middle-Earth, responsável por estabelecer os fundamentos da fantasia épica moderna.','["Fantasia", "Aventura"]'),
          ('Edgar Allan Poe',        1809, 'Americano',   'Mestre do conto de terror e mistério, pioneiro do gênero policial e da ficção científica nos Estados Unidos.',                 '["Terror", "Policial", "Mistério"]'),
          ('Fiódor Dostoiévski',     1821, 'Russo',       'Um dos maiores escritores de todos os tempos, explorou com profundidade a psicologia humana e as questões morais e existenciais.', '["Clássico", "Filosofia"]'),
          ('Clarice Lispector',      1920, 'Brasileira',  'Uma das escritoras mais singulares da literatura brasileira, conhecida pelo fluxo de consciência e pela prosa poética intensa.', '["Clássico", "Realismo"]'),
          ('Isaac Asimov',           1920, 'Americano',   'Um dos grandes mestres da ficção científica, autor prolífico que definiu conceitos centrais do gênero como as Leis da Robótica.','["Ficção Científica"]'),
          ('Stephen King',           1947, 'Americano',   'O rei do terror moderno, responsável por algumas das histórias mais assustadoras e populares da literatura contemporânea.',      '["Terror", "Policial"]'),
          ('Machado de Assis',       1839, 'Brasileiro',  'O maior escritor da literatura brasileira, fundador da Academia Brasileira de Letras e mestre do realismo psicológico.',         '["Clássico", "Realismo"]'),
          ('Friedrich Nietzsche',    1844, 'Alemão',      'Filósofo revolucionário cujas ideias sobre moral, poder e existência transformaram o pensamento ocidental.',                    '["Filosofia"]'),
          ('Monteiro Lobato',        1882, 'Brasileiro',  'O pai da literatura infantojuvenil brasileira, criador do Sítio do Picapau Amarelo e pioneiro da editoração nacional.',         '["Infantojuvenil", "Clássico"]'),
          ('Pablo Neruda',           1904, 'Chileno',     'Nobel de Literatura e um dos poetas mais lidos do século XX, celebrado por seus versos de amor e de engajamento político.',     '["Poesia"]'),
          ('Arthur Conan Doyle',     1859, 'Britânico',   'Criador de Sherlock Holmes, o detetive mais famoso da ficção, e responsável por popularizar o gênero policial em todo o mundo.','["Policial", "Mistério", "Aventura"]'),
          ('Júlio Verne',            1828, 'Francês',     'Pai da ficção científica moderna, suas aventuras futuristas previram submarinos, viagens espaciais e muitas outras tecnologias.','["Aventura", "Ficção Científica"]')
        ON CONFLICT DO NOTHING;
      `);
      console.log("✅ Autores inseridos.");
    }

    // ── Seed: Livros ───────────────────────────────────────────────
    const livrosExistentes = await client.query("SELECT COUNT(*) FROM livros");
    if (parseInt(livrosExistentes.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO livros (titulo, autor, nacionalidade, editora, ano, exemplares, isbn, genero, sinopse) VALUES

        -- Clássico
        ('Dom Quixote',
         'Miguel de Cervantes', 'Espanhol', 'Penguin', 1605, 3, '978-0142437230', 'Clássico',
         'Dom Quixote de la Mancha é um fidalgo espanhol que, obcecado pelos livros de cavalaria, perde o juízo e decide tornar-se cavaleiro andante. Acompanhado de seu fiel escudeiro Sancho Pança, sai em busca de aventuras, enfrentando moinhos de vento que imagina serem gigantes. É considerado o primeiro romance moderno e uma das obras mais importantes da literatura ocidental.'),

        ('A Metamorfose',
         'Franz Kafka', 'Tcheco', 'Companhia das Letras', 1915, 4, '978-8535922370', 'Clássico',
         'Gregor Samsa acorda certa manhã transformado em um monstruoso inseto. A partir desse evento absurdo, Kafka constrói uma poderosa metáfora sobre alienação, identidade e as relações familiares. A obra é um dos pilares da literatura do século XX e um dos textos mais analisados da história literária.'),

        -- Romance
        ('O Cortiço',
         'Aluísio Azevedo', 'Brasileiro', 'Ática', 1890, 4, '978-8508151172', 'Romance',
         'Retrato impiedoso da sociedade brasileira do final do século XIX, o romance acompanha a vida de moradores de um cortiço no Rio de Janeiro. Com linguagem crua e personagens marcantes, Azevedo denuncia as desigualdades sociais, o racismo e a exploração, numa obra fundamental do naturalismo brasileiro.'),

        ('Grande Sertão: Veredas',
         'João Guimarães Rosa', 'Brasileiro', 'Nova Fronteira', 1956, 3, '978-8520923252', 'Romance',
         'Narrado pelo jagunço Riobaldo, o livro conta sua vida no sertão mineiro, seus combates, suas dúvidas sobre um suposto pacto com o diabo e seu amor ambíguo por Diadorim. Com linguagem inovadora que mistura arcaísmos, neologismos e o falar sertanejo, é considerado o maior romance da literatura brasileira.'),

        -- Ficção Científica
        ('Fundação',
         'Isaac Asimov', 'Americano', 'Aleph', 1951, 5, '978-8576570936', 'Ficção Científica',
         'O matemático Hari Seldon desenvolve a psicohistória, ciência capaz de prever o futuro das massas, e prevê a queda do Império Galáctico. Para encurtar milênios de barbárie, cria a Fundação, repositório de todo o conhecimento humano. Considerado um dos maiores clássicos da ficção científica de todos os tempos.'),

        ('Eu, Robô',
         'Isaac Asimov', 'Americano', 'Aleph', 1950, 4, '978-8576570042', 'Ficção Científica',
         'Coletânea de contos interligados que exploram as Três Leis da Robótica e as consequências filosóficas e éticas de criar inteligências artificiais. Cada história apresenta um dilema único e fascinante sobre a relação entre humanos e máquinas, estabelecendo os fundamentos de toda a ficção científica moderna sobre robôs.'),

        -- Fantasia
        ('Harry Potter e a Pedra Filosofal',
         'J.K. Rowling', 'Britânica', 'Rocco', 1997, 5, '978-8532511010', 'Fantasia',
         'Harry Potter descobre no seu aniversário de onze anos que é um bruxo e é aceito na Escola de Magia e Bruxaria de Hogwarts. Lá, faz amigos, aprende feitiços e descobre a verdade sobre a morte misteriosa de seus pais. O início de uma das séries mais amadas da história da literatura.'),

        ('O Senhor dos Anéis: A Sociedade do Anel',
         'J.R.R. Tolkien', 'Britânico', 'Martins Fontes', 1954, 4, '978-8578273002', 'Fantasia',
         'O hobbit Frodo Baggins herda um anel mágico de seu tio Bilbo e descobre que se trata do Um Anel, criado pelo Senhor das Trevas Sauron para dominar todos os outros. Com uma sociedade de companheiros, Frodo parte numa jornada épica para destruir o anel nas chamas da Montanha da Perdição.'),

        -- Distopia
        ('1984',
         'George Orwell', 'Britânico', 'Companhia das Letras', 1949, 2, '978-8535914849', 'Distopia',
         'Em um futuro totalitário, Winston Smith trabalha no Ministério da Verdade reescrevendo a história conforme os interesses do Partido e do Grande Irmão. Ao se apaixonar por Julia e entrar em contato com uma suposta resistência, começa a questionar o sistema. Uma das mais poderosas críticas ao totalitarismo já escritas.'),

        ('Admirável Mundo Novo',
         'George Orwell', 'Britânico', 'Globo', 1932, 3, '978-8525432186', 'Distopia',
         'Em um futuro distante, a humanidade é condicionada desde o nascimento para ser feliz dentro de seu papel social predeterminado. Bernard Marx é o único que sente estranheza nesse mundo perfeito e controlado. Aldous Huxley criou uma das distopias mais perturbadoras da literatura, profética em muitos aspectos.'),

        -- Mistério
        ('O Assassinato no Expresso do Oriente',
         'Agatha Christie', 'Britânica', 'L&PM', 1934, 4, '978-8525415349', 'Mistério',
         'O detetive Hercule Poirot embarca no famoso trem Orient Express e, durante a viagem, um passageiro é assassinado. Com todos os suspeitos a bordo e nenhuma possibilidade de fuga, Poirot precisa desvendar o crime antes que o trem chegue ao destino. Um dos maiores clássicos do romance policial de todos os tempos.'),

        ('E Não Sobrou Nenhum',
         'Agatha Christie', 'Britânica', 'L&PM', 1939, 3, '978-8525415356', 'Mistério',
         'Dez pessoas são convidadas para uma ilha isolada e começam a morrer uma a uma, seguindo a ordem de uma cantiga infantil. Sem possibilidade de fuga e sem saber quem é o assassino, os sobreviventes vivem um terror crescente. Considerado o romance policial mais vendido da história, com mais de 100 milhões de cópias.'),

        -- Terror
        ('It: A Coisa',
         'Stephen King', 'Americano', 'Suma', 1986, 3, '978-8581051000', 'Terror',
         'Em Derry, uma cidadezinha do Maine, crianças desaparecem ciclicamente. Um grupo de amigos chamado Clube dos Perdedores enfrenta uma entidade maligna que se manifesta como Pennywise, o palhaço. Vinte e sete anos depois, quando os assassinatos recomeçam, os amigos retornam para terminar o que começaram. Uma obra monumental sobre o medo e a amizade.'),

        ('O Iluminado',
         'Stephen King', 'Americano', 'Suma', 1977, 4, '978-8581051017', 'Terror',
         'Jack Torrance aceita o emprego de zelador do isolado Hotel Overlook durante o inverno, levando sua esposa Wendy e o filho Danny. Danny possui uma habilidade paranormal chamada de "iluminado" e percebe que o hotel esconde forças malignas. À medida que o isolamento aumenta, Jack começa a perder a sanidade de forma assustadora.'),

        -- Aventura
        ('Vinte Mil Léguas Submarinas',
         'Júlio Verne', 'Francês', 'Zahar', 1870, 4, '978-8571104952', 'Aventura',
         'O professor Aronnax embarca numa expedição para investigar um misterioso monstro marinho e acaba prisioneiro do enigmático Capitão Nemo a bordo do submarino Nautilus. Durante meses, percorre os oceanos do mundo, descobrindo maravilhas e horrores das profundezas marinhas numa das obras mais visionárias da literatura.'),

        ('A Volta ao Mundo em 80 Dias',
         'Júlio Verne', 'Francês', 'Zahar', 1872, 5, '978-8571104969', 'Aventura',
         'O excêntrico inglês Phileas Fogg aposta todo o seu patrimônio que é capaz de dar a volta ao mundo em apenas 80 dias. Acompanhado de seu fiel servo Passepartout, enfrenta obstáculos, perseguições e aventuras em todos os continentes. Uma obra vibrante que captura o espírito aventureiro do século XIX.'),

        -- Realismo
        ('Dom Casmurro',
         'Machado de Assis', 'Brasileiro', 'Penguin', 1899, 5, '978-8563560858', 'Realismo',
         'Bentinho, o narrador, conta sua história de amor por Capitu desde a infância até o casamento e a separação. A questão central é se Capitu o traiu com seu melhor amigo Escobar. Machado de Assis criou um dos narradores mais intrigantes da literatura, deixando propositalmente a dúvida sobre a veracidade dos fatos narrados.'),

        ('A Hora da Estrela',
         'Clarice Lispector', 'Brasileira', 'Rocco', 1977, 4, '978-8532511126', 'Realismo',
         'Rodrigo S.M., um narrador masculino inventado por Clarice, conta a história de Macabéa, uma nordestina pobre e ignorante que vive no Rio de Janeiro. A obra é uma reflexão sobre a existência, sobre o ato de narrar e sobre os invisíveis da sociedade. O último romance de Clarice, publicado no mesmo ano de sua morte.'),

        -- Poesia
        ('Vinte Poemas de Amor e uma Canção Desesperada',
         'Pablo Neruda', 'Chileno', 'L&PM', 1924, 6, '978-8525404374', 'Poesia',
         'Publicado quando Neruda tinha apenas 19 anos, o livro é uma das coleções de poesia mais lidas da língua espanhola. Os poemas celebram o amor com uma intensidade e sensualidade raras, misturando a exaltação do desejo com a melancolia da perda. Uma obra de estreia extraordinária que lançou um dos maiores poetas do século XX.'),

        ('Alguma Poesia',
         'Carlos Drummond de Andrade', 'Brasileiro', 'Record', 1930, 5, '978-8501073082', 'Poesia',
         'Primeiro livro de Drummond, que inclui o célebre poema "No Meio do Caminho" com sua pedra repetida. A coletânea já apresenta a voz irônica, melancólica e profundamente humana que tornaria Drummond o maior poeta da literatura brasileira. Irreverente e inovadora, a obra marcou o modernismo nacional.'),

        -- Biografia
        ('O Diário de Anne Frank',
         'Anne Frank', 'Holandesa', 'Record', 1947, 6, '978-8501067388', 'Biografia',
         'Durante dois anos, a jovem judia Anne Frank escreveu um diário enquanto se escondia com sua família dos nazistas em Amsterdã. Com uma voz surpreendentemente madura e perspicaz para sua idade, Anne registrou seus medos, sonhos e reflexões sobre a humanidade. Um dos documentos mais tocantes sobre o Holocausto e a condição humana.'),

        ('Steve Jobs',
         'Walter Isaacson', 'Americano', 'Companhia das Letras', 2011, 4, '978-8535919929', 'Biografia',
         'Baseada em mais de quarenta entrevistas com o próprio Jobs e com centenas de amigos, familiares e rivais, esta é a biografia definitiva do gênio por trás da Apple. Isaacson revela um homem complexo, visionário e frequentemente difícil, cuja obsessão pela perfeição mudou para sempre a tecnologia, a música e o entretenimento.'),

        -- Filosofia
        ('Assim Falou Zaratustra',
         'Friedrich Nietzsche', 'Alemão', 'Companhia das Letras', 1883, 3, '978-8535911497', 'Filosofia',
         'Em forma de parábola filosófica, o profeta Zaratustra desce de sua montanha para proclamar a morte de Deus e o surgimento do Super-Homem. A obra central de Nietzsche apresenta conceitos como a vontade de poder e o eterno retorno numa prosa poética densa e provocadora que revolucionou o pensamento ocidental.'),

        ('A República',
         'Platão', 'Grego', 'Martins Fontes', 380, 3, '978-8578270582', 'Filosofia',
         'Por meio de diálogos liderados por Sócrates, Platão explora a natureza da justiça, do Estado ideal e da alma humana. A obra inclui os famosos mitos da Caverna e do Er, e discute a educação, a arte e o papel dos filósofos como governantes. Um dos textos fundadores da filosofia e da teoria política ocidental.'),

        -- Policial
        ('Um Estudo em Vermelho',
         'Arthur Conan Doyle', 'Britânico', 'Zahar', 1887, 5, '978-8571108974', 'Policial',
         'A primeira aparição de Sherlock Holmes e do Dr. Watson. Os dois se encontram pela primeira vez e Holmes demonstra seus extraordinários poderes de dedução ao resolver um misterioso assassinato em Londres. O romance que lançou o mais famoso detetive da literatura e redefiniu o gênero policial para sempre.'),

        ('O Cão dos Baskervilles',
         'Arthur Conan Doyle', 'Britânico', 'Zahar', 1902, 4, '978-8571108981', 'Policial',
         'Holmes e Watson são chamados para investigar a morte do Sir Charles Baskerville, cuja família está sob a maldição de um gigantesco cão fantasmagórico. Ambientado nos sombrios pântanos de Dartmoor, o romance é considerado a melhor aventura de Sherlock Holmes, combinando atmosfera gótica com raciocínio dedutivo brilhante.'),

        -- Histórico
        ('Cem Anos de Solidão',
         'Gabriel García Márquez', 'Colombiano', 'Record', 1967, 5, '978-8501012067', 'Histórico',
         'A saga da família Buendía ao longo de sete gerações na cidade fictícia de Macondo, na Colômbia. García Márquez mistura realidade e fantasia num estilo que ficou conhecido como realismo mágico, criando uma obra que é ao mesmo tempo a história de uma família, de um povo e de toda a América Latina. Nobel de Literatura em 1982.'),

        ('O Nome da Rosa',
         'Umberto Eco', 'Italiano', 'Record', 1980, 4, '978-8501073051', 'Histórico',
         'O frade franciscano Guilherme de Baskerville e seu novato Adso chegam a uma abadia beneditina italiana para participar de um debate teológico e se deparam com uma série de mortes misteriosas. Eco combina thriller, filosofia medieval, semiótica e história numa obra densa e fascinante que se tornou um fenômeno literário mundial.'),

        -- Infantojuvenil
        ('Reinações de Narizinho',
         'Monteiro Lobato', 'Brasileiro', 'Globo', 1931, 6, '978-8526010468', 'Infantojuvenil',
         'Narizinho e Pedrinho vivem no Sítio do Picapau Amarelo com a Vovó Benta e a Emília, a boneca falante. As aventuras do livro incluem uma viagem ao Reino das Águas Claras e encontros com personagens de contos de fadas. O primeiro grande clássico da literatura infantojuvenil brasileira, que encantou gerações de crianças.'),

        ('O Pequeno Príncipe',
         'Antoine de Saint-Exupéry', 'Francês', 'Agir', 1943, 8, '978-8522005710', 'Infantojuvenil',
         'Um piloto que faz um pouso forçado no deserto do Saara encontra um menino misterioso vindo de um asteroide distante. Através de suas conversas, o pequeno príncipe conta suas aventuras visitando diferentes planetas e personagens. Uma fábula filosófica atemporal sobre amizade, amor, solidão e o que os adultos esquecem ao crescer.')
      `);
      console.log("✅ Livros inseridos.");
    }

    // ── Seed: Admin bibliotecário ──────────────────────────────────
    const admExistente = await client.query(
      "SELECT COUNT(*) FROM bibliotecarios WHERE login = 'admin'"
    );
    if (parseInt(admExistente.rows[0].count) === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await client.query(
        `INSERT INTO bibliotecarios (nome, cpf, login, senha_hash)
         VALUES ('Admin Bibliotecário', '000.000.000-00', 'admin', $1)`,
        [hash]
      );
      console.log("✅ Admin criado (login: admin / senha: admin123).");
    }

    // ── Seed: Leitores de exemplo ──────────────────────────────────
    const leitoresExistentes = await client.query("SELECT COUNT(*) FROM leitores");
    if (parseInt(leitoresExistentes.rows[0].count) === 0) {
      const exemplos = [
        { nome: "Ana Luiza Pereira",    cpf: "123.456.789-00", login: "ana",    senha: "ana123" },
        { nome: "Carlos Eduardo Souza", cpf: "987.654.321-11", login: "carlos", senha: "carlos123" },
        { nome: "Juliana Ferreira",     cpf: "456.789.123-22", login: "juli",   senha: "juli123" },
      ];
      for (const l of exemplos) {
        const hash = await bcrypt.hash(l.senha, 10);
        await client.query(
          `INSERT INTO leitores (nome, cpf, login, senha_hash) VALUES ($1, $2, $3, $4)`,
          [l.nome, l.cpf, l.login, hash]
        );
      }
      console.log("✅ Leitores de exemplo inseridos.");
    }

    console.log("\n🎉 Banco de dados pronto!");
  } catch (err) {
    console.error("❌ Erro ao inicializar banco:", err.message);
  } finally {
    client.release();
    if (closePool) await pool.end();
  }
}

if (process.argv[1] === __filename) {
  await initDatabase();
  process.exit();
}