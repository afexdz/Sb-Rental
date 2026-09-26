import { test } from 'node:test'
import assert from 'node:assert/strict'
import { passportError, profileError } from '../src/client/model.ts'
import { queryError } from '../src/lib/queryError.ts'
test('profil client : nom, prénom, téléphone, email et passeport obligatoires', () => {
 assert.equal(profileError('Amine','Test','+213 555 123456','a@example.test',true),null)
 assert.match(profileError('','Test','123456','a@example.test',true)!,/prénom/)
 assert.match(profileError('Amine','Test','x','a@example.test',true)!,/téléphone/)
 assert.match(profileError('Amine','Test','123456','a@example.test',false)!,/passeport/)
 assert.match(passportError({type:'image/svg+xml',size:123})!,/format/)
 assert.match(passportError({type:'application/pdf',size:0})!,/non vide/)
 assert.match(passportError({type:'image/jpeg',size:10485761})!,/10 Mo/)
 assert.equal(passportError({type:'application/pdf',size:10485760}),null)
})
test('erreurs de requêtes : distinguer migration, RLS et réseau sans exposer de détails', () => {
 assert.match(queryError({code:'42703',message:'SECRET SQL'},'Véhicules'),/migrations/)
 assert.match(queryError({code:'42501'},'Données'),/RLS/)
 assert.match(queryError(new TypeError('fetch failed'),'Données'),/réseau/)
 assert.doesNotMatch(queryError({code:'42703',message:'SECRET SQL'},'Données'),/SECRET/)
})
