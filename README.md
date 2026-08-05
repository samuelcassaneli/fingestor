# FINGESTOR

FINGESTOR é um aplicativo web leve e progressivo (PWA) voltado para a gestão financeira pessoal. Desenvolvido com foco em velocidade e acessibilidade, ele funciona de forma totalmente independente de servidores externos, armazenando dados localmente e suportando execução offline completa.

---

## Funcionalidades Principais

* **Funcionamento Offline**: Cache completo de recursos estáticos via Service Worker, permitindo que a aplicação inicie e seja utilizada sem conexão com a internet.
* **Armazenamento Local Seguro**: Dados salvos diretamente no navegador do usuário utilizando `localStorage`, garantindo total privacidade e controle sobre as informações.
* **Interface Responsiva**: Design fluído e adaptável, otimizado tanto para dispositivos móveis (visualização vertical autônoma) quanto para desktop.
* **Controle de Fluxo de Caixa**: Registro rápido de entradas e saídas de capital com balanceamento em tempo real.

---

## Estrutura Técnica

* **Core**: HTML5 semântico e JavaScript vanila (ES6+) para maior performance e compatibilidade de navegadores.
* **Estilização**: CSS3 com layout responsivo (Flexbox e Grid).
* **PWA**: Manifesto de aplicativo web e ciclo de vida de Service Worker customizado para gerenciamento de cache.

---

## Instalação e Execução

Como é um aplicativo puramente cliente-side (PWA estático), ele não requer nenhum compilador ou ambiente de execução especial:

1. Clone o repositório.
2. Abra o arquivo `index.html` diretamente em qualquer navegador moderno.
3. Para testar o suporte a PWA e Service Worker offline de forma profissional, sirva o diretório local utilizando um servidor web simples de desenvolvimento:
   ```bash
   # Utilizando Python
   python -m http.server 8000
   
   # Ou utilizando Node.js (se instalado globalmente)
   npx serve .
   ```
4. Acesse a aplicação no seu navegador em `http://localhost:8000`.
