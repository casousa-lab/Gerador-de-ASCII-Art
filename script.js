const inputImagem = document.getElementById("inputImagem");
const dropzone = document.getElementById("dropzone");
const telaAscii = document.getElementById("telaAscii");
const btnBaixar = document.getElementById("btnBaixar");

// Rampa de caracteres do mais escuro para o mais claro
const CARACTERES = ["@", "#", "S", "%", "?", "*", "+", ";", ":", ",", ".", " "];

function processarArquivo(arquivo) {
    if (!arquivo) return;
    
    const leitor = new FileReader();
    
    leitor.onload = function(eventoDeLeitura) {
        const imagem = new Image();
        imagem.src = eventoDeLeitura.target.result;
        
        imagem.onload = function() {
            // 1. Definimos uma largura menor para caber na tela do terminal (ex: 80 colunas)
            const larguraDesejada = 80;
            
            // Calculamos a altura mantendo a proporção correta e ajustando o fator da fonte
            const proporcao = (imagem.height / imagem.width) / 1.65;
            const alturaDesejada = Math.floor(larguraDesejada * proporcao);
            
            // 2. Criamos um elemento <canvas> invisível na memória para desenhar a foto
            const canvas = document.createElement("canvas");
            canvas.width = larguraDesejada;
            canvas.height = alturaDesejada;
            const contexto = canvas.getContext("2d");
            
            // Desenha a imagem reduzida no canvas
            contexto.drawImage(imagem, 0, 0, larguraDesejada, alturaDesejada);
            
            // 3. Pegamos os dados de todos os pixels da imagem redimensionada
            const dadosImagem = contexto.getImageData(0, 0, larguraDesejada, alturaDesejada);
            const pixels = dadosImagem.data;
            
            let textoAscii = "";
            
            // 4. Percorremos cada pixel calculando o seu tom de cinza (brilho)
            for (let i = 0; i < pixels.length; i += 4) {
                const vermelho = pixels[i];
                const verde = pixels[i + 1];
                const azul = pixels[i + 2];
                
                // Média simples de brilho (escala de cinza)
                const brilho = (vermelho + verde + azul) / 3;
                
                // Escolhe o caractere correspondente com base no brilho
                const indice = Math.floor((brilho / 255) * (CARACTERES.length - 1));
                textoAscii += CARACTERES[indice];
                
                // Quando chega ao fim da largura, quebra a linha
                if ((i / 4 + 1) % larguraDesejada === 0) {
                    textoAscii += "\n";
                }
            }
            
            // 5. Joga o resultado final dentro da nossa tag <pre> no HTML!
            telaAscii.textContent = textoAscii;
            // Mostra o botão de baixar agora que a arte está pronta
            btnBaixar.style.display = "inline-block";
            
            // Quando o usuário clicar no botão de baixar...
            btnBaixar.onclick = function() {
                // Cria um arquivo de texto virtual na memória do navegador
                const blob = new Blob([textoAscii], { type: 'text/plain' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'ascii-art.txt'; // Nome do arquivo que será baixado
                
                // Simula um clique para o navegador iniciar o download
                link.click();
            };
        }
    }
    
    leitor.readAsDataURL(arquivo);
}

// Eventos de clique e arrastar que já criamos
inputImagem.addEventListener('change', function(evento) {
    const arquivo = evento.target.files[0];
    processarArquivo(arquivo);
});

dropzone.addEventListener('dragover', function(evento) {
    evento.preventDefault();
});

dropzone.addEventListener('drop', function(evento) {
    evento.preventDefault();
    const arquivo = evento.dataTransfer.files[0];
    processarArquivo(arquivo);
});