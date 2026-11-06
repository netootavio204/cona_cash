# 📱 PLANO DE GERAÇÃO DO APK NATIVO — CONA CASH

> **Versão Base**: `v1.0.0 beta`  
> **Plataforma Alvo**: Android 12 ou superior (Android 12, 13, 14 e 15 — API Level 31 a 35+)  
> **Tecnologia**: Capacitor 6 / 7 + React + Vite  
> **Backend**: Supabase (`okcxwxmqvfpgstdhpgvm`)  

---

## 1. Princípios & Regras do APK

1. **Layout 100% Celular**:
   - O aplicativo compilado para Android utiliza **estritamente o layout de celular** (barra de navegação inferior `BottomNav`, cards empilhados, fontes adaptadas e modais responsivos).
   - O menu lateral de desktop (`Sidebar`) permanece automaticamente oculto (`hidden lg:flex`), já que a tela do smartphone roda em viewport mobile.
2. **Mesma Base de Código e Dados**:
   - O APK consome exatamente o mesmo banco de dados do Supabase. Todos os lançamentos, contas, formas, categorias e metas sincronizam instantaneamente entre celular e computador.
3. **Segurança & Rede**:
   - `cleartext: false` (apenas tráfego criptografado HTTPS).
   - Esquema nativo configurado: `https://com.conacash.app`.

---

## 2. Pré-requisitos na Máquina

1. **Node.js** v18+ instalado (já presente na máquina).
2. **Android Studio** instalado:
   - Baixar em: [developer.android.com/studio](https://developer.android.com/studio)
   - Componentes no SDK Manager:
     - Android SDK Platform 34 ou 35
     - Android SDK Build-Tools 34.0.0+
     - Android SDK Command-line Tools
3. **Java JDK 17 ou 21** configurado na variável de ambiente `JAVA_HOME`.

---

## 3. Passo a Passo para Compilar o APK

Execute os comandos a partir da pasta `/app`:

### Passo 3.1: Compilar os assets web de produção
```bash
cd app
npm run build
```

### Passo 3.2: Inicializar o projeto Android no Capacitor (uma única vez)
```bash
npx cap add android
```
*Isso criará a pasta `app/android` com o projeto Gradle configurado.*

### Passo 3.3: Sincronizar os assets e plugins
```bash
npx cap sync android
```

### Passo 3.4: Abrir o projeto no Android Studio
```bash
npx cap open android
```

---

## 4. Gerando o arquivo APK no Android Studio

### Opção A: Gerar APK de Teste Imediato (Debug APK)
1. No menu superior do Android Studio, clique em:  
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. Ao concluir, o Android Studio mostrará uma notificação: `APK(s) generated successfully`.
3. Clique em **locate**. O arquivo estará em:  
   `app/android/app/build/outputs/apk/debug/app-debug.apk`
4. Copie o arquivo para a pasta `/APK` do projeto:
   `copy app\android\app\build\outputs\apk\debug\app-debug.apk ..\APK\ConaCash-v1.0.0-beta.apk`
5. Envie para o celular via WhatsApp, Google Drive ou cabo USB e instale diretamente.

### Opção B: Gerar APK Assinado para Produção (Release APK)
1. No menu do Android Studio, selecione:  
   **Build > Generate Signed Bundle / APK...**
2. Escolha **APK** e clique em **Next**.
3. Crie uma nova chave de assinatura (*Create new...*) e guarde o arquivo `.jks` e as senhas com segurança.
4. Selecione o modo **release** e marque **V1 (Jar Signature)** e **V2 (Full APK Signature)**.
5. Clique em **Finish**. O APK final assinado será gerado em:  
   `app/android/app/release/app-release.apk`

---

## 5. Ícones e Splash Screen do APK

Os ícones oficiais já estão preparados em alta resolução nos formatos 192x192 e 512x512 em `app/public/logos/`.
Para gerar automaticamente todas as resoluções de ícones e splash screen adaptativa do Android:
```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```

---

## 6. Checklist de Validação no Aparelho

- [ ] Instalação com sucesso em aparelho com Android 12, 13, 14 ou 15.
- [ ] Nome abaixo do ícone na tela inicial: **CONA CASH**.
- [ ] Abertura suave em tela cheia com barra de status escura.
- [ ] Login funcionando e mantendo sessão salva ao reabrir.
- [ ] Barra inferior (`BottomNav`) acessível com alvo de toque adequado.
- [ ] Exportação de relatórios em PDF abrindo no leitor nativo do celular.

