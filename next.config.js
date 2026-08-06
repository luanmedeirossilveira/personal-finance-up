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
};

module.exports = nextConfig;
