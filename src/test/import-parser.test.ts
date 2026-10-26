import { describe,it,expect } from "vitest";
import * as XLSX from "xlsx";
import { parseImport,cleanSerial,realignStone,validationDifference,numberValue } from "@/lib/import-parser.server";
import { normalizeName,validateMonth } from "@/lib/import-types";

const latin1 = (s:string) => Uint8Array.from([...s].map(c => c.charCodeAt(0)));
function workbook(paid:string|number = "Não pago", includeBonus = true) {
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["Franquia","Stone","Ton","Bobina","Triagem","Total"],["PB - PATOS FRANQUIA",30,10,0,5,45]]),"Consolidado");
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["OS","Status","Multa","Em_auditoria","Valor_base_OS","Valor_pago"],["12 3","(Tratamento) Sem Retorno",100,40,0,paid]]),"Analítico da OS");
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["Serial","Status_triagem","Valor_triagem"],['="ABC123"',"GOOD",5]]),"Analítico Triagem");
  if(includeBonus)XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["TMA_Stone","TMA_Ton","RV_meta"],[2,3,100]]),"Bonificação");
  return new Uint8Array(XLSX.write(book,{type:"array",bookType:"xlsx"}));
}
describe("Importação mensal",() => {
  it("lê CSV Latin-1 com ponto e vírgula preservando acentos",() => {
    const parsed=parseImport(latin1('Chamado;Prestador;Técnico;Cidade\r\n12 3;PB - PATOS FRANQUIA;João;São José'),"work.csv");
    expect(parsed.workinfinity[0]).toMatchObject({chamado:"12 3",chamado_key:"123",tecnico:"João",cidade:"São José"});
  });
  it("descarta CPF/CNPJ telefone endereço e texto livre antes de serializar",() => {
    const parsed=parseImport(latin1('Chamado;Prestador;CPF/CNPJ;Telefone;Endereço;Descrição motivo\n123;PB - PATOS;11122233344;999888777;RUA_CLIENTE;CONTATO_CLIENTE'),"work.csv");
    const stored=JSON.stringify(parsed);
    for(const pii of ["11122233344","999888777","RUA_CLIENTE","CONTATO_CLIENTE"])expect(stored).not.toContain(pii);
  });
  it('limpa o serial ="ABC123" para ABC123',() => {expect(cleanSerial('="ABC123"')).toBe("ABC123");});
  it("realinha Sem Retorno usando Multa e Em_auditoria e conta a correção",() => {
    const parsed=parseImport(workbook(),"stone.xlsx");
    expect(parsed.stone[0]).toMatchObject({os_key:"123",valor_base_os:100,valor_pago:40,status_pagamento:"Não pago",multa:0,em_auditoria:0,was_realigned:true});
    expect(parsed.realigned_rows_count).toBe(1);
  });
  it("não realinha Sem Retorno com pagamento numérico",() => {
    expect(realignStone({status:"(Tratamento) Sem Retorno",valorpago:"40,00",multa:5,emauditoria:0,valorbaseos:100}).was_realigned).toBe(false);
  });
  it("recusa realinhamento sem fontes numéricas para não corromper valores",() => {
    expect(() => realignStone({status:"(Tratamento) Sem Retorno",valorpago:"Não pago",multa:"inválido",emauditoria:40})).toThrow();
  });
  it("compara pagamento corrigido a Stone + Ton + Bobina sem incluir Triagem",() => {
    const parsed=parseImport(workbook(),"stone.xlsx");
    expect(parsed.totals["total_validation_diff"]).toBe(0);
    expect(validationDifference(42,30,10,0)).toBe(2);
  });
  it("lê as quatro abas e os campos da triagem e bonificação",() => {
    const parsed=parseImport(workbook(),"stone.xlsx");
    expect(parsed.triagem[0]).toMatchObject({serial:"ABC123",status_triagem:"GOOD",valor_triagem:5});
    expect(parsed.bonificacao[0]).toMatchObject({tma_stone:2,tma_ton:3,rv_payload:{rvmeta:100}});
  });
  it("recusa XLSX sem aba Bonificação",() => {expect(() => parseImport(workbook(40,false),"stone.xlsx")).toThrow("Bonificação");});
  it("normaliza nomes conforme a equivalência em maiúsculas e espaços simples",() => {expect(normalizeName(" pb  - patos franquia ")).toBe("PB - PATOS FRANQUIA");});
  it("recusa um CSV com mais de uma franquia",() => {expect(() => parseImport(latin1("Chamado;Prestador\n1;PATOS\n2;MACAU"),"work.csv")).toThrow("mais de uma franquia");});
  it("valida mês de referência no primeiro dia",() => {expect(validateMonth("2026-10-01")).toBe("2026-10-01");expect(() => validateMonth("2026-13-01")).toThrow();expect(() => validateMonth("2026-10-02")).toThrow();});
  it("lê moeda brasileira sem interpretar texto como número",() => {expect(numberValue("R$ 1.234,56")).toBe(1234.56);expect(numberValue("Não pago")).toBeNull();});
});