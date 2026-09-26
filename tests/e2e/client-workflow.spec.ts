import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
const config = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
if (new URL(config.API_URL).hostname !== '127.0.0.1') throw new Error('Tests uniquement sur Supabase local.')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const publicClient = () => createClient(config.API_URL, config.PUBLISHABLE_KEY || config.ANON_KEY, options)
const password = 'Workflow-test-583!'
const pdf = Buffer.from('%PDF-1.4\nSB TEST PASSPORT - NOT A REAL DOCUMENT\n%%EOF')
// Additive tests: fixtures are intentionally retained. No cleanup/reset/delete.
async function user(role = 'client', approved = false, isAdmin = false) {
 const email = `sb-workflow-${randomUUID()}@example.test`
 const result = await service.auth.admin.createUser({ email,password,email_confirm:true,user_metadata:{role,full_name:'Workflow Test'} })
 expect(result.error).toBeNull()
 const id = result.data.user!.id
 if (role === 'agency') expect((await service.from('agency_requests').insert({profile_id:id,business_name:`Agence ${id.slice(0,8)}`,rc_number:`TEST-${id}`,document_path:`${id}/rc.pdf`,status:approved?'approved':'pending'})).error).toBeNull()
 if (isAdmin) expect((await service.from('app_admins').insert({email,user_id:id})).error).toBeNull()
 const api = publicClient(); expect((await api.auth.signInWithPassword({email,password})).error).toBeNull()
 return {id,email,api}
}
async function googleUser() {
 const email = `sb-google-${randomUUID()}@example.test`
 const result = await service.auth.admin.createUser({ email,password,email_confirm:true,user_metadata:{name:'Google Workflow Client',provider_id:`google-${randomUUID()}`},app_metadata:{provider:'google',providers:['google']} })
 expect(result.error).toBeNull()
 const api = publicClient(); expect((await api.auth.signInWithPassword({email,password})).error).toBeNull()
 return {id:result.data.user!.id,email,api}
}
async function session(page: Page, account: Awaited<ReturnType<typeof user>>, path='/mon-compte') {
 const {data} = await account.api.auth.getSession()
 await page.addInitScript(({url,value}) => localStorage.setItem(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,JSON.stringify(value)), {url:config.API_URL,value:data.session})
 await page.goto(path)
}
async function submit(account: Awaited<ReturnType<typeof user>>) {
 const path = `${account.id}/${randomUUID()}.pdf`
 expect((await account.api.storage.from('client-passports').upload(path,pdf,{contentType:'application/pdf'})).error).toBeNull()
 expect((await account.api.rpc('submit_client_profile',{p_first_name:'Amine',p_last_name:'Test',p_phone:'+213555123456',p_email:account.email,p_passport_path:path})).error).toBeNull()
 return path
}
test('RLS : pending, consentement privé, vérification et réservation idempotente', async () => {
 const client=await user(), agency=await user('agency',true), outsider=await user('agency',true), pending=await user('agency'), admin=await user('client',false,true)
 expect((await client.api.rpc('client_is_verified',{target:client.id})).data).toBe(false)
 expect((await client.api.rpc('start_conversation',{p_agency_id:pending.id})).error).toBeTruthy()
 const convo=await client.api.rpc('start_conversation',{p_agency_id:agency.id}); expect(convo.error).toBeNull(); const cid=convo.data
 expect((await client.api.rpc('start_conversation',{p_agency_id:agency.id})).data).toBe(cid)
 expect((await client.api.rpc('send_conversation_message',{p_conversation_id:cid,p_body:'Bonjour agence'})).error).toBeNull()
 expect((await agency.api.rpc('conversation_client_status',{p_conversation_id:cid})).data).toBe('pending')
 expect((await outsider.api.rpc('send_conversation_message',{p_conversation_id:cid,p_body:'Intrusion'})).error).toBeTruthy()
 expect((await outsider.api.from('conversation_messages').select().eq('conversation_id',cid)).data).toEqual([])
 const path=await submit(client)
 expect((await client.api.from('client_verifications').update({status:'verified'}).eq('client_id',client.id)).error).toBeTruthy()
 expect((await client.api.rpc('verify_client_passport',{p_client_id:client.id,p_expected_path:path})).error).toBeTruthy()
 expect((await agency.api.storage.from('client-passports').createSignedUrl(path,60)).error).toBeTruthy()
 expect((await outsider.api.storage.from('client-passports').createSignedUrl(path,60)).error).toBeTruthy()
 expect((await agency.api.from('client_verifications').select().eq('client_id',client.id)).data).toEqual([])
 expect((await agency.api.rpc('request_passport_review',{p_conversation_id:cid})).error).toBeNull()
 expect((await client.api.rpc('authorize_passport_review',{p_conversation_id:cid,p_allow:true})).error).toBeNull()
 expect((await agency.api.storage.from('client-passports').createSignedUrl(path,60)).error).toBeNull()
 expect((await admin.api.storage.from('client-passports').createSignedUrl(path,60)).error).toBeNull()
 expect((await outsider.api.storage.from('client-passports').createSignedUrl(path,60)).error).toBeTruthy()
 expect((await fetch(client.api.storage.from('client-passports').getPublicUrl(path).data.publicUrl)).ok).toBe(false)
 const car=await agency.api.from('vehicles').insert({agency_id:agency.id,brand:'TEST Workflow',model:'208',category:'city',daily_price_cents:500000,active:true}).select().single(); expect(car.error).toBeNull()
 const args={p_vehicle_id:car.data.id,p_start_date:'2027-02-01',p_end_date:'2027-02-03',p_request_id:randomUUID()}
 expect((await client.api.rpc('create_client_reservation',args)).error).toBeTruthy()
 expect((await agency.api.rpc('verify_client_passport',{p_client_id:client.id,p_expected_path:path})).error).toBeNull()
 const booking=await client.api.rpc('create_client_reservation',args); expect(booking.error).toBeNull(); expect(booking.data.total_cents).toBe(1000000); expect(booking.data.deposit_cents).toBe(100000)
 expect((await client.api.rpc('create_client_reservation',args)).data.id).toBe(booking.data.id)
 expect((await client.api.rpc('create_client_reservation',{...args,p_request_id:randomUUID()})).error).toBeTruthy()
 expect((await client.api.rpc('authorize_passport_review',{p_conversation_id:cid,p_allow:false})).error).toBeNull()
 expect((await agency.api.storage.from('client-passports').createSignedUrl(path,60)).error).toBeTruthy()
 const replacement=await submit(client)
 expect((await client.api.rpc('client_is_verified',{target:client.id})).data).toBe(false)
 expect((await agency.api.rpc('verify_client_passport',{p_client_id:client.id,p_expected_path:path})).error).toBeTruthy()
 expect((await outsider.api.storage.from('client-passports').createSignedUrl(replacement,60)).error).toBeTruthy()
 expect((await service.storage.getBucket('client-passports')).data?.public).toBe(false)
})

test('navigateur : profil complémentaire, fichier obligatoire, chat pending et vérification agence', async ({page,browser},info) => {
 const client=await user(),agency=await user('agency',true)
 await session(page,client)
 await expect(page.getByRole('heading',{name:'Vérification de votre profil'})).toBeVisible()
 await expect(page.getByLabel('Téléversez votre passeport')).toHaveAttribute('required','')
 await page.getByLabel('Nom',{exact:true}).fill('Test')
 await page.getByLabel('Prénom',{exact:true}).fill('Amine')
 await page.getByLabel('Téléphone',{exact:true}).fill('+213555123456')
 await page.getByLabel('Téléversez votre passeport').setInputFiles({name:'test-passport.pdf',mimeType:'application/pdf',buffer:pdf})
 await page.getByRole('button',{name:'Terminer mon profil',exact:true}).click()
 await expect(page.getByText('Profil envoyé.',{exact:false})).toBeVisible()
 await expect(page.getByRole('button',{name:'Réserver ce véhicule'})).toBeDisabled()
 await page.getByLabel('Agence vérifiée').selectOption(agency.id)
 await page.getByRole('button',{name:'Contacter l’agence',exact:true}).click()
 await page.getByRole('button',{name:'Actualiser les conversations'}).click()
 await page.getByRole('button',{name:/Échange client/}).click()
 await page.getByLabel('Votre message').fill('Bonjour, je souhaite réserver après vérification.')
 await page.getByRole('button',{name:'Envoyer le message'}).click()
 await expect(page.getByLabel('Messages de la conversation')).toContainText('Bonjour')
 const context=await browser.newContext({viewport: info.project.name==='mobile'?{width:390,height:844}:{width:1440,height:1000}}), agencyPage=await context.newPage()
 await session(agencyPage,agency,'/agence')
 await expect(agencyPage.getByText('Téléversez votre passeport')).toHaveCount(0)
 await agencyPage.getByRole('button',{name:/Échange client/}).click()
 await expect(agencyPage.getByText('Client pending · passeport non vérifié')).toBeVisible()
 await agencyPage.getByRole('button',{name:'Demander la vérification du passeport'}).click()
 await expect(page.getByRole('button',{name:'Autoriser cette agence à consulter mon passeport'})).toBeVisible({timeout:20000})
 await page.getByRole('button',{name:'Autoriser cette agence à consulter mon passeport'}).click()
 await expect(agencyPage.getByRole('button',{name:'Consulter le passeport privé'})).toBeVisible({timeout:20000})
 await agencyPage.getByRole('button',{name:'Confirmer la vérification du passeport'}).click()
 await expect(agencyPage.getByText('Client vérifié',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Actualiser les disponibilités et mon statut'}).click()
 await expect(page.getByRole('button',{name:'Réserver ce véhicule'})).toBeEnabled()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:info.outputPath('client-workflow.png'),fullPage:true})
 await agencyPage.screenshot({path:info.outputPath('agency-chat.png'),fullPage:true})
 await context.close()
})

test('retour de session Google : profil complémentaire, passeport requis et statut pending', async ({page}, info) => {
 const client = await googleUser()
 await session(page,client)
 await expect(page.getByRole('heading',{name:'Vérification de votre profil'})).toBeVisible()
 await expect(page.getByLabel('Email de connexion')).toHaveValue(client.email)
 await expect(page.getByLabel('Téléversez votre passeport')).toHaveAttribute('required','')
 await page.getByLabel('Nom',{exact:true}).fill('Client')
 await page.getByLabel('Prénom',{exact:true}).fill('Google')
 await page.getByLabel('Téléphone',{exact:true}).fill('+213555123456')
 await page.getByRole('button',{name:'Terminer mon profil',exact:true}).click()
 await expect(page.getByText('Profil envoyé.',{exact:false})).toHaveCount(0)
 expect(await page.locator('#passport').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true)
 const label = (await page.locator('label[for="passport"]').boundingBox())!
 const input = (await page.locator('#passport').boundingBox())!
 expect(input.y).toBeGreaterThanOrEqual(label.y + label.height)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.locator('section[aria-labelledby="verification-title"]').screenshot({path:info.outputPath('profil-passeport.png')})
 await page.getByLabel('Téléversez votre passeport').setInputFiles({name:'google-test-passport.pdf',mimeType:'application/pdf',buffer:pdf})
 await page.getByRole('button',{name:'Terminer mon profil',exact:true}).click()
 await expect(page.getByText('Profil envoyé.',{exact:false})).toBeVisible()
 await expect(page.getByText('Client pending · en attente de vérification.',{exact:false})).toBeVisible()
 await expect(page.getByRole('button',{name:'Réserver ce véhicule'})).toBeDisabled()
})

test('routes et Google : accès direct protégé et destination du formulaire complémentaire', async ({page}) => {
 await page.goto('/agence'); await expect(page).toHaveURL(/\/connexion$/)
 await expect(page.getByRole('button',{name:'Continuer avec Google'})).toBeVisible()
 let oauthUrl=''
 await page.route('**/auth/v1/authorize**',async route=>{oauthUrl=route.request().url();await route.fulfill({status:200,contentType:'text/html',body:'<p>OAuth intercepté pour test</p>'})})
 await page.getByRole('button',{name:'Continuer avec Google'}).click()
 await expect.poll(()=>oauthUrl).toContain('provider=google')
 expect(new URL(oauthUrl).searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/mon-compte')
 await page.goto('/admin'); await expect(page.getByRole('heading',{name:'Connexion administrateur.'})).toBeVisible()
})
