import { useState } from 'react';
import { templatesFor, generateQuestion } from '../engine/registry';
import type { CategoryId, Format, Response } from '../engine/types';
import { STAGES } from '../engine/types';
import { t } from '../i18n/i18n';
import { SceneView, needsPictureInPlain } from '../activities/SceneView';
import { AnswerPanel } from '../components/AnswerPanel';
import { SOLUTION } from '../activities/sceneTypes';

/**
 * QA gallery (open with ?gallery=C01 … C14, optional &format=plain&seed=7&solution=1).
 * Renders every template of one category at all three stages so art, layout and
 * rendering can be checked quickly. Not linked from the child-facing app.
 */
export function Gallery() {
  const params = new URLSearchParams(location.search);
  const cat = (params.get('gallery') || 'C01') as CategoryId;
  const format = (params.get('format') || 'interactive') as Format;
  const seed = Number(params.get('seed') || 7);
  const solution = params.get('solution') === '1';
  const lang = params.get('lang') === 'ta' ? 'ta' : 'en';
  const answers = params.get('answers') === '1';
  return (
    <div className="screen gallery">
      <h1>QA gallery — {cat} — {format}{solution ? ' — solution' : ''}</h1>
      {STAGES.map((stage) => (
        <section key={stage}>
          <h2>{stage}</h2>
          <div className="gallery-grid">
            {templatesFor(cat, stage).map((tpl) => <Item key={tpl.id} id={tpl.id} seed={seed} format={format} solution={solution} lang={lang} answers={answers} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function Item({ id, seed, format, solution, lang, answers }: { id: string; seed: number; format: Format; solution: boolean; lang: 'en' | 'ta'; answers: boolean }) {
  const q = generateQuestion(id, seed, format);
  const [work, setWork] = useState<Record<string, unknown>>({});
  const [resp, setResp] = useState<Response | undefined>();
  return (
    <article className="card" data-testid={`gallery-${id}`}>
      <p className="small muted">{id} · {q.subskill}{q.extension ? ' · extension' : ''}</p>
      <h3 className="prompt">{t(format === 'plain' ? q.plain ?? q.prompt : q.prompt, lang)}</h3>
      {(format !== 'plain' || needsPictureInPlain(q)) && (
        <SceneView q={q} work={work} setWork={setWork} response={resp} setResponse={setResp} interactive={format === 'interactive'} reveal={solution ? SOLUTION : 0} bw={format === 'plain'} />
      )}
      {answers || q.answer.kind === 'choice' ? <AnswerPanel answer={q.answer} response={resp} onChange={setResp} /> : <p className="small muted">answer: {q.answer.kind}</p>}
      {solution && <p className="small">{t(q.explain, lang)}</p>}
    </article>
  );
}
