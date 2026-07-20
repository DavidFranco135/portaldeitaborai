# 🌲 EDI – Gestão de Madeiras

Sistema de gestão comercial para representação de madeiras: pedidos, romaneios, clientes e cálculos automáticos de M³.

## Funcionalidades

- **Calculadora bidirecional**: informe quantidade → calcula M³, ou informe M³ → calcula quantidade
- **Documentos**: Pedido (para fábrica) e Romaneio (para cliente) com layout A4 para impressão/PDF
- **Comissão automática**: 5% deduzido do subtotal (configurável)
- **Clientes completos**: CNPJ, endereço, IE, telefone – tudo aparece no documento impresso
- **Firebase Firestore**: dados sincronizados na nuvem
- **localStorage**: fallback automático se Firebase não estiver configurado
- **Deploy**: pronto para Cloudflare Pages

## Instalação

```bash
npm install
```

## Configurar Firebase

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. Adicione um app Web ao projeto
3. Copie o objeto `firebaseConfig`
4. Crie `.env.local` na raiz:

```env
VITE_FIREBASE_API_KEY=sua_chave
VITE_FIREBASE_AUTH_DOMAIN=seuprojeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seuprojeto
VITE_FIREBASE_STORAGE_BUCKET=seuprojeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc
```

5. No Firebase Console, ative o **Firestore Database** e configure as regras:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // mude para autenticação em produção
    }
  }
}
```

## Rodar localmente

```bash
npm run dev
```

## Build para produção

```bash
npm run build
```

## Deploy no Cloudflare Pages

1. Suba o código no GitHub
2. Conecte o repositório no [Cloudflare Pages](https://pages.cloudflare.com)
3. Build command: `npm run build`
4. Output directory: `dist`
5. Adicione as variáveis `VITE_FIREBASE_*` nas configurações de ambiente
6. Aponte seu domínio para o projeto

## Estrutura do projeto

```
src/
├── components/
│   ├── Layout.tsx          # Sidebar + navegação
│   └── TimberCalculator.tsx # Tabela bidirecional de cálculo
├── lib/
│   ├── calc.ts             # Lógica de cálculo M³
│   ├── firebase.ts         # Serviço Firestore
│   ├── firebase.config.ts  # Configuração Firebase
│   └── pdf.ts              # Exportação PDF A4
├── pages/
│   ├── Dashboard.tsx
│   ├── Clientes.tsx
│   ├── DocumentManager.tsx # Pedido e Romaneio
│   ├── Relatorios.tsx      # Lista com filtro por data
│   └── Configuracoes.tsx
├── store/
│   └── AppContext.tsx       # Estado global + Firebase sync
└── types.ts
```
