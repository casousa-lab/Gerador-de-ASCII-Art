# ASCII Studio

Editor de posters em ASCII art com pré-visualização ao vivo, direto no navegador. Carregue uma imagem, transforme-a em texto ASCII, combine com camadas de texto e formas, escolha uma paleta e exporte o resultado em alta resolução.

100% front-end: HTML, CSS e JavaScript puro (vanilla), sem build, sem dependências de framework e sem back-end.

## Funcionalidades

**Imagem de origem**
- Carregue uma imagem por clique, arraste-e-solte ou colando com `Ctrl+V`
- Recorte, zoom, giro em 90°, espelhamento horizontal/vertical
- Imagem de exemplo pronta para testar o editor sem precisar subir um arquivo

**Motor ASCII**
- Conjuntos de caracteres prontos (Clássico, Suave, Detalhado, Blocos, Binário) ou um conjunto personalizado
- Controle de colunas, fonte monoespaçada, negrito, altura de linha e inversão do ramp
- Ajustes de brilho, contraste, gama, detecção de bordas e dither
- Coloração mono, gradiente ou baseada nas cores originais da imagem, com opção de brilho/glow

**Poster e camadas**
- Camadas de texto (múltiplas fontes, peso, itálico, espaçamento, alinhamento, maiúsculas) e de formas (linha, retângulo, elipse)
- Manipulação direto no palco: arrastar para mover, alça inferior para redimensionar, alça superior para girar, com encaixe automático ao centro (desligável com Alt)
- Reordenar, duplicar, ocultar, bloquear e excluir camadas
- Tamanho do poster por presets (A3/A4, Instagram, Story, quadrado, paisagem 16:9 etc.) ou dimensões customizadas
- Fundo sólido ou em gradiente, moldura (sólida, tracejada, pontilhada ou dupla), vinheta e grão

**Paletas**
- 8 paletas prontas (Terminal, Âmbar CRT, Papel e tinta, Cianótipo, Neon, Pôr do sol, Alto contraste, Grafite) aplicáveis com um clique

**Exportação e projeto**
- Exportação em PNG, JPG ou TXT (somente o texto ASCII)
- Resolução de exportação em 1x a 4x, com fundo transparente opcional em PNG
- Copiar o texto ASCII para a área de transferência
- Salvar e abrir o projeto em `.json` (guarda estado, camadas e a imagem usada)

**Histórico e atalhos**
- Desfazer / refazer (`Ctrl+Z` / `Ctrl+Shift+Z` ou `Ctrl+Y`)
- Duplicar camada (`Ctrl+D`), salvar projeto (`Ctrl+S`)
- Excluir camada selecionada (`Delete`/`Backspace`), mover com as setas (`Shift` para passo maior), `Esc` para desmarcar

## Estrutura do projeto

```
.
├── index.html    # marcação e estrutura dos painéis
├── style.css     # tema visual (bancada clara monocromática)
├── script.js     # toda a lógica: estado, motor ASCII, renderização, interação e exportação
└── favicon.svg   # ícone do app
```

## Como usar

Não há dependências para instalar nem passo de build. Basta abrir `index.html` em um navegador moderno, ou servir a pasta com qualquer servidor estático:

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Depois acesse `http://localhost:8000` no navegador.

## Tecnologias

- HTML5 (Canvas API para renderização e exportação)
- CSS3 (custom properties, grid e flexbox)
- JavaScript (ES6+), sem frameworks ou bibliotecas externas
- Fontes via Google Fonts (carregadas por CDN)

## Compatibilidade

Testado em navegadores modernos com suporte a Canvas 2D, `FileReader` e Clipboard API (Chrome, Edge, Firefox). Layout responsivo, com um modo empilhado para telas menores.
