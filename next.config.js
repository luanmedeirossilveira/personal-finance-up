/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
    // unpdf empacota o pdfjs; carregue-o em runtime (não pelo webpack) para
    // evitar problemas de bundling na rota de leitura de nota em PDF.
    serverComponentsExternalPackages: ["unpdf"],
  },
  // v3: 5 telas viraram 3 fluxos. Links antigos (e-mails, favoritos) continuam funcionando.
  async redirects() {
    return [
      { source: "/dashboard", destination: "/hoje", permanent: false },
      { source: "/contas", destination: "/mes", permanent: false },
      { source: "/future", destination: "/mes", permanent: false },
      { source: "/debts", destination: "/patrimonio?tab=dividas", permanent: false },
      { source: "/checkin", destination: "/revisao", permanent: false },
    ];
  },
};

module.exports = nextConfig;
