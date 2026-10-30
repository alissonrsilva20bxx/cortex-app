/** Texto visível dos LiveLinks do perfil da Rede: o formulário
 * (components/rede/LiveLinkForm.tsx), os avisos da validação
 * (lib/rede/perfis.ts) e os recados da tela (components/rede/RedeTab.tsx).
 *
 * O nome "LiveLink" ainda não foi decidido pelo capitão; com o texto aqui,
 * trocar o nome é uma linha. Os avisos da validação recebem o limite de
 * tamanho por parâmetro para não importar perfis.ts (que importa este
 * arquivo) e não criar dependência circular. */
export const TEXTOS_LIVELINK = {
  form: {
    tituloNovo: "Novo LiveLink",
    tituloEditar: "Editar LiveLink",
    botaoAdicionar: "Adicionar LiveLink",
    botaoSalvar: "Salvar alterações",
    campo: {
      titulo: "Título",
      link: "Link",
    },
    exemplo: {
      titulo: "Ex: Meu Instagram",
      url: "https://instagram.com/seuusuario",
    },
  },
  /** Avisos da validação: em português, dizem o que corrigir, então podem ir
   * para a tela. */
  avisos: {
    tituloTamanho: (max: number) =>
      `Título do LiveLink deve ter entre 1 e ${max} caracteres`,
    urlTamanho: (max: number) =>
      `URL do LiveLink deve ter entre 1 e ${max} caracteres`,
    urlHttps: "URL do LiveLink deve ser uma URL HTTPS absoluta",
  },
  atualizado: "LiveLink atualizado!",
  adicionado: "LiveLink adicionado!",
  excluido: "LiveLink excluído",
  erroSalvar: "Não foi possível salvar o LiveLink.",
  erroExcluir: "Não foi possível excluir o LiveLink.",
  erroReordenar: "Não foi possível reordenar os LiveLinks.",
} as const;
