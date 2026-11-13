// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {App} from '../src/main';
const review={pontosFortes:['Objetivo claro'],inconsistencias:['Falta duração'],sugestoes:['Definir duração']};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()});
describe('interface',()=>{
 it('valida formulário vazio sem chamar API',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Analisar com IA/}));expect(screen.getByRole('alert').textContent).toContain('Preencha');expect(fetch).not.toHaveBeenCalled()});
 it('preenche exemplo, exibe retorno simulado, permite editar e copiar',async()=>{const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>review});vi.stubGlobal('fetch',fetch);const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Usar exemplo fictício/}));fireEvent.click(screen.getByRole('button',{name:/Analisar com IA/}));const output=await screen.findByLabelText('Análise editável') as HTMLTextAreaElement;expect(output.value).toContain('Objetivo claro');fireEvent.change(output,{target:{value:'Minha revisão'}});fireEvent.click(screen.getByRole('button',{name:/Copiar sugestões/}));await waitFor(()=>expect(writeText).toHaveBeenCalledWith('Minha revisão'));expect(fetch).toHaveBeenCalledTimes(1)});
 it('apresenta erro recebido da API',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'Acesso indisponível'})}));render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Usar exemplo fictício/}));fireEvent.click(screen.getByRole('button',{name:/Analisar com IA/}));expect((await screen.findByRole('alert')).textContent).toContain('Acesso indisponível')});
});
