import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TEXTOS_NAO_ENCONTRADA as T } from "@/lib/textosNaoEncontrada";
import styles from "./login/entry.module.css";

/**
 * Endereço que não existe: no lugar do 404 padrão do Next (em inglês e sem
 * saída, R17 B3), a mesma moldura das telas de entrada com um botão de
 * volta ao início.
 */
export default function NaoEncontrada() {
  return (
    <div className={styles.page}>
      <div className={styles.screen}>
        <section className={styles.intro}>
          <h1>{T.titulo}</h1>
          <p>{T.texto}</p>
        </section>
        <Link href="/" className={styles.primary}>
          {T.voltar} <ArrowRight />
        </Link>
      </div>
    </div>
  );
}
