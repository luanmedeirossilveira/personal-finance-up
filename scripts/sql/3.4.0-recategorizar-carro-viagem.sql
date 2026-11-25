-- 3.4.0 — recategorização OPCIONAL dos lançamentos atuais para "carro" e "viagem".
-- Não é migration de schema (por isso fica fora de drizzle/): só move para as categorias novas o
-- que hoje está em Transporte (financiamento, IPVA, licenciamento…) ou em Lazer (parcelas de viagem),
-- para essas duas mostrarem só o gasto controlável do mês.
--
-- Só mexe em meses ABERTOS: mês fechado tem o resumo congelado em month_closings e fica como está.
-- A migração de mês copia a categoria, então os meses seguintes herdam a mudança.
-- O LIKE do SQLite ignora caixa (ASCII). Rode as prévias, confira e ajuste os padrões antes dos UPDATE.

-- ── Prévia ──────────────────────────────────────────────────────────────────
SELECT 'conta → carro' AS acao, b.id, b.month, b.year, b.name, b.amount
FROM bills b
WHERE b.type = 'NORMAL' AND b.category = 'transporte'
  AND (b.name LIKE '%CARRO%' OR b.name LIKE '%IPVA%' OR b.name LIKE '%LICENCIAMENTO%' OR b.name LIKE '%DETRAN%' OR b.name LIKE '%SEGURO AUTO%')
  AND NOT EXISTS (SELECT 1 FROM month_closings mc WHERE mc.user_id = b.user_id AND mc.month = b.month AND mc.year = b.year)
UNION ALL
SELECT 'conta → viagem', b.id, b.month, b.year, b.name, b.amount
FROM bills b
WHERE b.type = 'NORMAL' AND b.category = 'lazer'
  AND (b.name LIKE '%VIAGEM%' OR b.name LIKE '%PASSAGEM%' OR b.name LIKE '%HOTEL%' OR b.name LIKE '%AIRBNB%' OR b.name LIKE '%LATAM%' OR b.name LIKE '%DECOLAR%' OR b.name LIKE '%BOOKING%' OR b.name LIKE '%AZUL%')
  AND NOT EXISTS (SELECT 1 FROM month_closings mc WHERE mc.user_id = b.user_id AND mc.month = b.month AND mc.year = b.year)
UNION ALL
SELECT 'compra → carro', t.id, b.month, b.year, t.name, t.amount
FROM card_transactions t JOIN bills b ON b.id = t.bill_id
WHERE t.category = 'transporte'
  AND (t.name LIKE '%CARRO%' OR t.name LIKE '%IPVA%' OR t.name LIKE '%LICENCIAMENTO%' OR t.name LIKE '%DETRAN%' OR t.name LIKE '%SEGURO AUTO%')
  AND NOT EXISTS (SELECT 1 FROM month_closings mc WHERE mc.user_id = b.user_id AND mc.month = b.month AND mc.year = b.year)
UNION ALL
SELECT 'compra → viagem', t.id, b.month, b.year, t.name, t.amount
FROM card_transactions t JOIN bills b ON b.id = t.bill_id
WHERE t.category = 'lazer'
  AND (t.name LIKE '%VIAGEM%' OR t.name LIKE '%PASSAGEM%' OR t.name LIKE '%HOTEL%' OR t.name LIKE '%AIRBNB%' OR t.name LIKE '%LATAM%' OR t.name LIKE '%DECOLAR%' OR t.name LIKE '%BOOKING%' OR t.name LIKE '%AZUL%')
  AND NOT EXISTS (SELECT 1 FROM month_closings mc WHERE mc.user_id = b.user_id AND mc.month = b.month AND mc.year = b.year);

-- ── Aplicar ─────────────────────────────────────────────────────────────────
UPDATE bills SET category = 'carro', updated_at = datetime('now')
WHERE type = 'NORMAL' AND category = 'transporte'
  AND (name LIKE '%CARRO%' OR name LIKE '%IPVA%' OR name LIKE '%LICENCIAMENTO%' OR name LIKE '%DETRAN%' OR name LIKE '%SEGURO AUTO%')
  AND NOT EXISTS (SELECT 1 FROM month_closings mc WHERE mc.user_id = bills.user_id AND mc.month = bills.month AND mc.year = bills.year);

UPDATE bills SET category = 'viagem', updated_at = datetime('now')
WHERE type = 'NORMAL' AND category = 'lazer'
  AND (name LIKE '%VIAGEM%' OR name LIKE '%PASSAGEM%' OR name LIKE '%HOTEL%' OR name LIKE '%AIRBNB%' OR name LIKE '%LATAM%' OR name LIKE '%DECOLAR%' OR name LIKE '%BOOKING%' OR name LIKE '%AZUL%')
  AND NOT EXISTS (SELECT 1 FROM month_closings mc WHERE mc.user_id = bills.user_id AND mc.month = bills.month AND mc.year = bills.year);

UPDATE card_transactions SET category = 'carro'
WHERE category = 'transporte'
  AND (name LIKE '%CARRO%' OR name LIKE '%IPVA%' OR name LIKE '%LICENCIAMENTO%' OR name LIKE '%DETRAN%' OR name LIKE '%SEGURO AUTO%')
  AND bill_id IN (
    SELECT b.id FROM bills b
    WHERE NOT EXISTS (SELECT 1 FROM month_closings mc WHERE mc.user_id = b.user_id AND mc.month = b.month AND mc.year = b.year)
  );

UPDATE card_transactions SET category = 'viagem'
WHERE category = 'lazer'
  AND (name LIKE '%VIAGEM%' OR name LIKE '%PASSAGEM%' OR name LIKE '%HOTEL%' OR name LIKE '%AIRBNB%' OR name LIKE '%LATAM%' OR name LIKE '%DECOLAR%' OR name LIKE '%BOOKING%' OR name LIKE '%AZUL%')
  AND bill_id IN (
    SELECT b.id FROM bills b
    WHERE NOT EXISTS (SELECT 1 FROM month_closings mc WHERE mc.user_id = b.user_id AND mc.month = b.month AND mc.year = b.year)
  );
