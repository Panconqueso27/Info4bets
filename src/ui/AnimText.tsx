/**
 * Texto animado: los títulos entran letra a letra con rebote y el texto
 * corrido palabra a palabra. Cambiar `text` reinicia la animación.
 * Con "reducir movimiento" activado en el sistema, se muestra quieto.
 */
export function Letters({ text, delay = 0, class: cls = '' }: { text: string; delay?: number; class?: string }) {
  let i = 0;
  return (
    <span class={`anim-letters ${cls}`} key={text} aria-label={text}>
      {text.split(' ').map((word, w) => (
        <>
          {w > 0 && ' '}
          <span class="anim-word" aria-hidden="true">
            {[...word].map((ch) => (
              <span class="anim-ch" style={{ '--i': i++, '--d': `${delay}ms` } as any}>
                {ch}
              </span>
            ))}
          </span>
        </>
      ))}
    </span>
  );
}

export function Words({ text, delay = 120, class: cls = '' }: { text: string; delay?: number; class?: string }) {
  return (
    <span class={`anim-words ${cls}`} key={text}>
      {text.split(' ').map((word, i) => (
        <>
          {i > 0 && ' '}
          <span class="anim-w" style={{ '--i': i, '--d': `${delay}ms` } as any}>
            {word}
          </span>
        </>
      ))}
    </span>
  );
}
