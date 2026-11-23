import React, { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Box, Check, Gift, Headphones, Heart, House, Leaf, MapPin, Menu, Minus, Plus, RotateCcw, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Star, Truck, UserRound, X } from 'lucide-react';
import '@fontsource-variable/dm-sans';
import '@fontsource/fraunces/latin-500.css';
import { api } from './api.js';
import { activeEvents, categories, events, money, pickupPoints, shippingMethods, TERMS_VERSION, totals } from '../shared/rules.js';
import seed from '../shared/catalog.json';
import './style.css';

const icons = { Tech: Headphones, Maison: House, 'Bien-être': Leaf, Loisirs: Gift, Épicerie: Box };
const demoPoints = pickupPoints.map(point => <option key={point.id} value={point.id}>{point.address}</option>);
const imagePath = product => '/media/' + product.image + '.webp';
const productPath = product => '/article/' + product.id;

function useRequest(path) {
  const [state, setState] = useState({});
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setState({ loading: true });
    api(path, { signal: abort.signal }).then(data => setState({ data })).catch(error => {
      if (!abort.signal.aborted) setState({ error: error.message });
    });
    return () => abort.abort();
  }, [path, revision]);
  return { ...state, reload: () => refresh(value => value + 1) };
}

function Brand() {
  return <Link className="brand" to="/" aria-label="ez-commerce, accueil"><span className="brand-icon"><ShoppingBag size={19}/></span><span>ez<span className="dot">.</span>commerce</span></Link>;
}

function Header({ count, user }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [menu, setMenu] = useState(false);
  const featured = activeEvents().find(event => event.id === 'noel') ?? activeEvents()[0];
  return <>
    <div className="ribbon"><Sparkles size={13}/> −25 % sur la livraison au-delà de 20 € d’achats <ArrowRight size={13}/></div>
    <header className="shell header">
      <Brand/>
      <form className="search" onSubmit={event => { event.preventDefault(); navigate('/boutique?q=' + encodeURIComponent(search.trim())); }}>
        <Search size={19}/><input aria-label="Rechercher dans la boutique" placeholder="Chercher un produit, une marque…" value={search} onChange={event => setSearch(event.target.value)}/>
        <button aria-label="Lancer la recherche" type="submit"><ArrowRight size={17}/></button>
      </form>
      <div className="header-actions">
        <Link to="/compte"><UserRound size={20}/><span>{user ? user.name.split(' ')[0] : 'Compte'}</span></Link>
        <Link to="/panier" className="basket"><ShoppingBag size={20}/><span>Panier</span><b>{count}</b></Link>
        <button className="menu icon-btn" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>
      </div>
    </header>
    <nav className={'nav ' + (menu ? 'nav-open' : '')} aria-label="Navigation de la boutique">
      <div className="shell nav-inner" onClick={() => setMenu(false)}>
        <Link className="all-link" to="/boutique"><Menu size={16}/> Toutes les catégories</Link>
        {categories.map(category => <Link key={category} to={'/boutique?category=' + encodeURIComponent(category)}>{category}</Link>)}
        <Link className="event-link" to={featured ? '/evenements/' + featured.id : '/evenements'}><Gift size={16}/> {featured?.title ?? 'Événements'}</Link>
      </div>
    </nav>
  </>;
}

function Footer() {
  return <footer><div className="shell footer"><Brand/><p>Boutique de démonstration · France métropolitaine</p><div><Link to="/evenements">Événements</Link><Link to="/conditions">Conditions de vente</Link><Link to="/confidentialite">Confidentialité</Link></div></div></footer>;
}

function PromoServices() {
  const items = [
    [Truck, 'Livraison suivie', 'À partir de 4,79 €'],
    [ShieldCheck, 'Paiement de test', 'Stripe Checkout'],
    [RotateCcw, 'Conditions claires', 'Délais, livraison et retours'],
    [Gift, 'Fidélité récompensée', '5 € par tranche de 100 €'],
  ];
  return <div className="benefits">{items.map(([Icon, title, desc]) => <div key={title}><Icon size={24}/><span><strong>{title}</strong><small>{desc}</small></span></div>)}</div>;
}

function Hero() {
  const season = activeEvents().find(item => item.id === 'noel') ?? activeEvents()[0];
  const christmas = season?.id === 'noel';
  return <section className={'hero ' + (christmas ? 'winter' : '')}>
    <div className="hero-copy">
      <span className="eyebrow"><Sparkles size={14}/> {christmas ? 'La boutique de Noël' : season?.title ?? 'La sélection ez-commerce'}</span>
      <h1>{christmas ? <>De belles choses.<br/><em>À offrir.</em></> : <>Les bons achats,<br/><em>simplement.</em></>}</h1>
      <p>{christmas ? 'Des idées cadeaux pour ceux qui comptent. Tech, maison et trouvailles à glisser sous le sapin.' : 'Une sélection pour le quotidien, les cadeaux et les envies du moment.'}</p>
      <Link className="button cream" to={season ? '/evenements/' + season.id : '/boutique'}>Explorer la sélection <ArrowRight size={17}/></Link>
    </div>
    {christmas && <span className="hero-caption">Sélection de saison</span>}
  </section>;
}

function ProductCard({ product, add, saved, toggle }) {
  const discount = product.previous > product.price ? Math.round((1 - product.price / product.previous) * 100) : 0;
  return <article className="product">
    <div className="product-media" style={{ backgroundColor: product.color }}>
      <Link to={productPath(product)} aria-label={product.name}><img src={imagePath(product)} alt="" loading="lazy" width="550" height="460"/></Link>
      {discount > 0 && <span className="sale">−{discount} %</span>}
      <button className={'heart icon-btn ' + (saved ? 'is-saved' : '')} onClick={() => toggle(product.id)} aria-pressed={saved} aria-label={'Favori · ' + product.name}><Heart size={18}/></button>
    </div>
    <div className="product-info">
      <span className="meta">{product.category} / {product.brand}</span>
      <Link className="product-name" to={productPath(product)}>{product.name}</Link>
      <span className="rating"><Star size={13} fill="currentColor"/>{product.reviewCount ? product.rating.toFixed(1) + ' (' + product.reviewCount + ')' : 'Aucun avis'}</span>
      <div className="product-bottom"><span><strong>{money(product.price)}</strong> {discount > 0 && <del>{money(product.previous)}</del>}</span>
      <button className="add icon-btn" disabled={!product.stock} onClick={() => add(product)} aria-label={'Ajouter ' + product.name + ' au panier'}><Plus size={21}/></button></div>
    </div>
  </article>;
}

function ProductGrid({ products, shop }) {
  return <div className="grid">{products.map(product => <ProductCard key={product.id} product={product} {...shop} saved={shop.favorites.includes(product.id)}/>)}</div>;
}

function Home({ shop }) {
  const { data } = useRequest('catalog');
  const picks = (data?.products ?? seed).slice(0, 4);
  return <main id="main" className="shell">
    <Hero/>
    <PromoServices/>
    <section className="section">
      <div className="section-head"><div><span className="kicker"><span/> La sélection</span><h2>Les favoris du moment</h2></div><Link to="/boutique">Voir tous les articles <ArrowRight size={17}/></Link></div>
      <ProductGrid products={picks} shop={shop}/>
    </section>
    <section className="section">
      <div className="section-head"><div><span className="kicker"><span/> Explorer</span><h2>À chacun son rayon</h2></div></div>
      <div className="categories">{categories.map(category => {
        const Icon = icons[category];
        return <Link key={category} to={'/boutique?category=' + encodeURIComponent(category)}><Icon/><strong>{category}</strong><ArrowRight size={17}/></Link>;
      })}</div>
    </section>
  </main>;
}

function Catalog({ shop }) {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const query = new URLSearchParams(params);
  if (id) query.set('event', id);
  const { data, loading, error } = useRequest('catalog?' + query);
  const event = events.find(item => item.id === id);
  function update(name, value) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    }, { replace: true });
  }
  if (id && !event) return <Missing/>;
  return <main id="main" className="shell page">
    <Link className="back" to={event ? '/evenements' : '/'}><ArrowLeft size={16}/> {event ? 'Tous les événements' : 'Accueil'}</Link>
    <div className={'page-title ' + (event ? 'event-banner' : '')}><span className="kicker"><span/> {event ? 'Événement' : 'Le catalogue'}</span><h1>{event?.title ?? (params.get('q') ? 'Résultats de recherche' : 'La boutique')}</h1>
    {event && <p>{event.subtitle} {activeEvents().some(item => item.id === id) ? 'Événement en cours.' : 'Collection hors saison.'}</p>}
    {params.get('q') && <p>Recherche pour « {params.get('q')} »</p>}</div>
    <div className="catalog-layout">
      <aside className="filters" aria-label="Filtres des articles">
        <h2><SlidersHorizontal size={18}/> Filtrer</h2>
        <label>Catégorie<select value={params.get('category') ?? ''} onChange={e => update('category', e.target.value)}><option value="">Toutes</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Prix maximum<select value={params.get('max') ?? ''} onChange={e => update('max', e.target.value)}><option value="">Tous les prix</option>{[15, 25, 35, 50].map(max => <option key={max} value={max * 100}>{max} €</option>)}</select></label>
        <label>Livraison avant<select value={params.get('days') ?? ''} onChange={e => update('days', e.target.value)}><option value="">Toutes les estimations</option><option value="2">Dans 2 jours</option><option value="3">Dans 3 jours</option><option value="5">Dans 5 jours</option></select></label>
        <label className="check"><input type="checkbox" checked={params.has('sale')} onChange={e => update('sale', e.target.checked ? '1' : '')}/> Promotions</label>
        <label className="check"><input type="checkbox" checked={params.has('stock')} onChange={e => update('stock', e.target.checked ? '1' : '')}/> En stock</label>
        <button className="text" onClick={() => setParams({})}>Réinitialiser les filtres</button>
      </aside>
      <section>
        <div className="catalog-toolbar"><p aria-live="polite">{data ? data.products.length + ' article(s)' : 'Articles'}</p><label>Trier par <select value={params.get('sort') ?? ''} onChange={e => update('sort', e.target.value)}><option value="">Sélection</option><option value="price">Prix croissant</option><option value="price-desc">Prix décroissant</option><option value="rating">Mieux notés</option></select></label></div>
        {loading && <p>Chargement du catalogue…</p>}
        {error && <p role="alert">{error}</p>}
        {data && (data.products.length ? <ProductGrid products={data.products} shop={shop}/> : <p className="panel">Aucun résultat. Essaie une autre recherche ou réinitialise les filtres.</p>)}
      </section>
    </div>
  </main>;
}

function EventIndex() {
  const current = activeEvents().map(event => event.id);
  return <main id="main" className="shell page">
    <Link className="back" to="/"><ArrowLeft size={16}/> Accueil</Link>
    <div className="page-title"><span className="kicker"><span/> Au fil des saisons</span><h1>Événements</h1></div>
    <div className="event-grid">{events.map(event => <Link key={event.id} to={'/evenements/' + event.id} className="panel event-tile"><Gift/><span>{current.includes(event.id) ? 'En cours' : 'Collection saisonnière'}</span><h2>{event.title}</h2><p>{event.subtitle}</p><ArrowRight/></Link>)}</div>
  </main>;
}

function ProductDetail({ shop, user, notify }) {
  const { id } = useParams();
  const { data, error, reload } = useRequest('catalog?action=product&id=' + encodeURIComponent(id) + '&account=' + Boolean(user));
  const [reviewError, setReviewError] = useState('');
  const [saving, setSaving] = useState(false);
  if (error) return <main id="main" className="shell page"><p role="alert">{error}</p><Link to="/boutique">Retour à la boutique</Link></main>;
  if (!data) return <main id="main" className="shell page"><p>Chargement de l’article…</p></main>;
  const { product, reviews, canReview } = data;
  const url = new URL(productPath(product), window.location.origin).href;
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); }
      catch (error) { if (error.name !== 'AbortError') notify('Utilise le bouton Copier le lien.'); }
    } else await copy();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); notify('Lien copié.'); }
    catch { notify('Copie le lien depuis la barre d’adresse.'); }
  }
  async function review(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSaving(true);
    setReviewError('');
    try {
      await api('catalog?action=review', { method: 'POST', body: { id, rating: Number(values.get('rating')), comment: values.get('comment') } });
      notify('Avis publié.');
      reload();
    } catch (error) { setReviewError(error.message); }
    finally { setSaving(false); }
  }
  return <main id="main" className="shell page">
    <Link className="back" to="/boutique"><ArrowLeft size={16}/> Retour à la boutique</Link>
    <div className="detail">
      <div className="detail-image" style={{ backgroundColor: product.color }}><img src={imagePath(product)} alt={'Illustration de ' + product.name}/></div>
      <div className="detail-copy"><span className="kicker"><span/>{product.category} / {product.brand}</span><h1>{product.name}</h1>
        <a className="rating" href="#avis"><Star size={16} fill="currentColor"/>{product.reviewCount ? product.rating.toFixed(1) + ' / 5 · ' + product.reviewCount + ' avis' : 'Aucun avis pour le moment'}</a>
        <p className="detail-price"><strong>{money(product.price)}</strong> {product.previous > product.price && <del>{money(product.previous)}</del>}</p>
        <p>{product.description}</p>
        <p className="stock"><Truck size={18}/> {product.stock ? 'Livraison estimée sous ' + product.days + ' jours' : 'Rupture de stock'}</p>
        <button className="button" onClick={() => shop.add(product)} disabled={!product.stock}><ShoppingBag size={18}/> Ajouter au panier</button>
        <div className="share"><a href={'https://wa.me/?text=' + encodeURIComponent(product.name + ' ' + url)} target="_blank" rel="noreferrer">WhatsApp</a><button className="text" onClick={share}>Partager</button><button className="text" onClick={copy}>Copier le lien pour Instagram</button></div>
        <a className="source" href={product.reference} target="_blank" rel="noreferrer">Référence fabricant <ArrowRight size={14}/></a>
      </div>
    </div>
    <section className="section reviews" id="avis"><div className="section-head"><div><span className="kicker"><span/> Achats vérifiés</span><h2>Avis clients</h2></div></div>
      {reviews.length ? reviews.map(item => <article className="panel" key={item.name + item.created_at}><strong>{item.name}</strong><p className="rating" aria-label={item.rating + ' étoiles'}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</p><p>{item.comment}</p></article>) : <p>Aucun avis publié pour cet article.</p>}
      {canReview && <form className="panel form" onSubmit={review}><h3>Donner ou modifier mon avis</h3><label>Note<select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map(number => <option key={number}>{number}</option>)}</select></label><label>Commentaire<textarea name="comment" minLength="10" maxLength="1000" required/></label>{reviewError && <p role="alert">{reviewError}</p>}<button className="button" disabled={saving}>Publier</button></form>}
    </section>
  </main>;
}

function Cart({ shop, user, notify }) {
  const [method, setMethod] = useState('home');
  const [point, setPoint] = useState('paris');
  const [address, setAddress] = useState({ street: '', postal: '', city: '' });
  const [mapAddress, setMapAddress] = useState('');
  const [useCredit, setCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const orderState = useRequest(user ? 'orders' : 'orders?action=config');
  const config = useRequest('orders?action=config');
  const pending = orderState.data?.orders?.find(order => order.state === 'pending');
  const amount = pending?.amounts ?? totals(shop.lines, method, useCredit ? user?.credit ?? 0 : 0);
  const estimate = shop.lines.length ? Math.max(...shop.lines.map(line => line.days)) + shippingMethods[method].extraDays : 0;
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY;
  const destination = method === 'pickup' ? pickupPoints.find(item => item.id === point).address : Object.values(address).join(' ').trim();
  async function submit(event, cancel = false) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (cancel) {
        await api('orders?action=cancel', { method: 'POST' });
        orderState.reload();
        await shop.refresh();
        notify('État de la commande mis à jour.');
      } else {
        const delivery = pending?.delivery ?? (method === 'pickup' ? { method, point } : { method, ...address });
        const result = await api('orders?action=checkout', { method: 'POST', body: { terms: TERMS_VERSION, useCredit, delivery } });
        window.location.assign(result.url);
      }
    } catch (error) { setError(error.message); orderState.reload(); }
    finally { setBusy(false); }
  }
  return <main id="main" className="shell page">
    <Link className="back" to="/boutique"><ArrowLeft size={16}/> Continuer mes achats</Link>
    <div className="page-title"><span className="kicker"><span/> Ma commande</span><h1>Ton panier</h1></div>
    {!shop.lines.length && !pending ? <div className="panel empty"><ShoppingBag size={38}/><h2>Ton panier est vide</h2><Link className="button" to="/boutique">Découvrir la boutique <ArrowRight size={16}/></Link></div> :
    <form onSubmit={submit} className="checkout">
      <div className="checkout-main">
        <section className="panel"><h2>Articles</h2>{shop.lines.map(line => <div className="cart-line" key={line.id}>
          <Link to={productPath(line)}><img src={imagePath(line)} alt="" width="80" height="65"/></Link><div><Link to={productPath(line)}><strong>{line.name}</strong></Link><p>{money(line.price)} / unité</p></div>
          <div className="quantity"><button className="icon-btn" type="button" disabled={shop.updating || Boolean(pending)} onClick={() => shop.update(line, line.quantity - 1)} aria-label="Retirer une unité"><Minus size={15}/></button><span>{line.quantity}</span><button className="icon-btn" type="button" disabled={shop.updating || Boolean(pending)} onClick={() => shop.update(line, line.quantity + 1)} aria-label="Ajouter une unité"><Plus size={15}/></button></div>
        </div>)}</section>
        {!pending && <section className="panel form">
          <h2><MapPin size={23}/> Livraison</h2><label>Mode de livraison<select value={method} onChange={e => { setMethod(e.target.value); setMapAddress(''); }}>{Object.entries(shippingMethods).map(([key, value]) => <option value={key} key={key}>{value.label} · {money(value.cents)}</option>)}</select></label>
          {method === 'home' ? <><label>Adresse<input required name="street" autoComplete="street-address" minLength={5} maxLength={150} value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })}/></label><div className="address-grid"><label>Code postal<input required name="postal" autoComplete="postal-code" inputMode="numeric" pattern="(0[1-9]|[1-8][0-9]|9[0-5])[0-9]{3}" value={address.postal} onChange={e => setAddress({ ...address, postal: e.target.value })}/></label><label>Ville<input required name="city" minLength={2} maxLength={80} autoComplete="address-level2" value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })}/></label></div></> : <label>Point relais de démonstration<select value={point} onChange={e => { setPoint(e.target.value); setMapAddress(''); }}>{demoPoints}</select></label>}
          <div className="map-preview"><MapPin size={24}/><span>Google Maps</span>{mapsKey ? <button type="button" className="text" disabled={!destination} onClick={() => setMapAddress(destination)}>Afficher sur la carte</button> : <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(destination || 'France')} target="_blank" rel="noreferrer">Vérifier dans Google Maps <ArrowRight size={14}/></a>}</div>
          {mapAddress && mapsKey && <iframe className="map" title="Carte de l’adresse sélectionnée" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={'https://www.google.com/maps/embed/v1/place?key=' + encodeURIComponent(mapsKey) + '&q=' + encodeURIComponent(mapAddress)}/>}
        </section>}
        {pending && <section className="panel"><h2>Paiement en attente</h2><p>Adresse enregistrée : {pending.delivery.address}</p><button className="text" type="button" disabled={busy} onClick={e => submit(e, true)}>Annuler le paiement en attente</button></section>}
      </div>
      <section className="panel summary form">
        <h2>Récapitulatif</h2><dl><dt>Articles</dt><dd>{money(amount.subtotal)}</dd><dt>Livraison</dt><dd>{money(amount.shipping)}</dd>{amount.shippingDiscount > 0 && <><dt>Économie sur la livraison</dt><dd>{money(amount.shippingDiscount)}</dd></>}{amount.discount > 0 && <><dt>Crédit fidélité</dt><dd>−{money(amount.discount)}</dd></>}<dt className="sum-total">Total TTC</dt><dd className="sum-total">{money(amount.total)}</dd></dl>
        <p className="note"><Truck size={17}/> Livraison estimée sous {pending?.delivery.days ?? estimate} jours en France métropolitaine.</p>
        {!pending && user?.credit > 0 && <label className="check"><input type="checkbox" checked={useCredit} onChange={e => setCredit(e.target.checked)}/> Utiliser mon crédit de {money(user.credit)}</label>}
        {user ? <>{!pending && <label className="check"><input required type="checkbox"/><span>J’accepte les <Link to="/conditions" target="_blank">conditions de vente de démonstration</Link>.</span></label>}
          <button className="button" disabled={busy || (!config.data?.stripe && !config.data?.demo)}>{pending ? 'Reprendre le paiement' : config.data?.stripe ? 'Payer avec Stripe (test)' : 'Simuler le paiement'} <ArrowRight size={17}/></button>
          <small>Aucun débit réel en démonstration.</small>
          {!config.loading && !config.data?.stripe && !config.data?.demo && <p role="status">Le paiement de test n’est pas configuré.</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </> : <Link className="button" to="/compte?from=panier">Se connecter pour commander <ArrowRight size={17}/></Link>}
      </section>
    </form>}
  </main>;
}

function Account({ user, refresh, notify, mergeCart }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const history = useRequest(user ? 'orders' : 'auth');
  async function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setBusy(true);
    try {
      await api('auth?action=' + (register ? 'register' : 'login'), { method: 'POST', body: fields });
      const unmerged = await mergeCart();
      await refresh();
      notify(unmerged ? 'Certains articles sont encore dans ton panier invité.' : register ? 'Ton compte a été créé.' : 'Connexion réussie.');
      if (params.get('from') === 'panier') navigate('/panier');
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    try {
      await api('auth?action=logout', { method: 'POST' });
      await refresh();
    } catch (error) { setError(error.message); }
  }
  const progress = user ? user.spent % 10000 : 0;
  return <main id="main" className="shell page">
    <Link className="back" to="/"><ArrowLeft size={16}/> Accueil</Link>
    <div className="page-title"><span className="kicker"><span/> Espace personnel</span><h1>{user ? 'Bonjour, ' + user.name.split(' ')[0] : 'Mon compte'}</h1></div>
    {user ? <div className="account-layout">
      <section className="panel"><h2><Gift size={24}/> Mes avantages</h2><p className="detail-price"><strong>{money(user.credit)}</strong> de crédit</p><progress max="10000" value={progress} aria-label="Progression vers le prochain crédit"/><p>Encore {money(10000 - progress)} d’articles payés pour gagner 5 €.</p><p>{user.email}</p><button className="text" onClick={logout}>Se déconnecter</button>{error && <p role="alert">{error}</p>}</section>
      <section className="panel"><h2>Mes commandes</h2>
        {params.get('payment') === 'demo' && <p className="success" role="status"><Check size={18}/> Commande de démonstration confirmée.</p>}
        {params.get('payment') === 'success' && <p className="success" role="status">Retour de Stripe. La commande passe à « Confirmée » après validation serveur.</p>}
        {history.error && <p role="alert">{history.error}</p>}
        {history.loading && <p>Chargement…</p>}
        {history.data?.orders?.length ? history.data.orders.map(order => <article className="order" key={order.id}>
          <div><strong>{order.state === 'paid' ? 'Confirmée' : order.state === 'pending' ? 'En attente' : 'Expirée'}</strong><span>{new Date(order.created_at).toLocaleDateString('fr-FR')}</span><b>{money(order.amounts.total)}</b></div>
          <ul>{order.lines.map(line => <li key={line.id}><Link to={productPath(line)}>{line.quantity} × {line.name}</Link></li>)}</ul>
          {order.state === 'pending' && <Link to="/panier">Reprendre ou annuler le paiement</Link>}
        </article>) : history.data?.orders && <p>Tu n’as pas encore passé de commande.</p>}
        <button className="text" type="button" onClick={history.reload}>Actualiser les commandes</button>
      </section>
    </div> : <div className="account-layout auth-layout">
      <form className="panel form" onSubmit={submit}><h2>{register ? 'Créer un compte' : 'Se connecter'}</h2>
        {register && <label>Prénom ou pseudonyme<input name="name" required minLength={2} maxLength={50} autoComplete="nickname"/></label>}
        <label>Adresse e-mail<input type="email" name="email" required maxLength={254} autoComplete="email"/></label>
        <label>Mot de passe<input type="password" name="password" required minLength={12} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'}/></label>
        {register && <small>12 caractères minimum. Utilise des données de test.</small>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button" disabled={busy}>{register ? 'Créer mon compte' : 'Me connecter'} <ArrowRight size={17}/></button>
        <button className="text" type="button" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'J’ai déjà un compte' : 'Créer un compte'}</button>
      </form>
      <section className="panel account-promo"><Gift size={34}/><h2>Achats récompensés</h2><p>Gagne 5 € de crédit à chaque tranche de 100 € d’articles payés, hors livraison.</p></section>
    </div>}
  </main>;
}

function Legal({ privacy = false }) {
  return <main id="main" className="shell page legal">
    <Link className="back" to="/"><ArrowLeft size={16}/> Accueil</Link>
    <div className="page-title"><span className="kicker"><span/> Boutique de démonstration</span><h1>{privacy ? 'Confidentialité' : 'Conditions de vente'}</h1></div>
    {privacy ? <div className="panel">
      <h2>Données de test</h2><p>Utilise une adresse de test et une adresse de livraison fictive. Le service conserve ton pseudonyme, ton e-mail, ton panier et ton historique de test. Les mots de passe sont stockés après dérivation cryptographique. Le prénom ou pseudonyme et le commentaire sont publics lorsque tu publies un avis.</p>
      <h2>Services externes</h2><p>Stripe traite les coordonnées de carte saisies sur son écran hébergé. Google Maps reçoit l’adresse recherchée lorsque tu affiches la carte ou ouvres Google Maps. Les boutons de partage transmettent le lien de l’article au service choisi.</p>
      <h2>Session et favoris</h2><p>Un cookie de session permet de rester connecté pendant sept jours. Le panier invité et les favoris sont stockés dans ce navigateur. Le document de préparation à la mise en vente détaille les informations à ajouter avant une exploitation réelle.</p>
    </div> : <div className="panel">
      <p><strong>Version {TERMS_VERSION}</strong></p><p>La boutique simule des achats en France métropolitaine. Les articles, les prix, les stocks et les points relais servent à tester le parcours. Le paiement Stripe utilise des cartes de test. Aucune expédition ni aucun débit réel n’a lieu.</p>
      <h2>Prix et livraison</h2><p>Le panier affiche les prix TTC de démonstration. La livraison indicative coûte 5,49 € à domicile ou 4,79 € en point relais. Une remise de 25 % s’applique aux frais quand le sous-total des articles dépasse strictement 20 €, avant utilisation du crédit fidélité. Les délais sont affichés avant le paiement.</p>
      <h2>Fidélité</h2><p>Chaque tranche cumulée de 100 € d’articles payés, après déduction du crédit utilisé et hors livraison, donne droit à 5 € de crédit utilisables sur un achat ultérieur. Le crédit est rattaché au compte, sans valeur monétaire ni transfert.</p>
      <h2>Avis</h2><p>Un compte qui a terminé la commande de test peut publier ou modifier un avis par article. Les avis sont visibles sur la fiche de l’article.</p>
      <h2>Vente réelle et retours</h2><p>Le projet de CGV destiné à une future boutique prévoit notamment l’information précontractuelle, le droit de rétractation et les garanties légales. Il doit être complété avec l’identité du vendeur, ses coordonnées et ses modalités d’expédition et de retour avant ouverture commerciale.</p>
    </div>}
  </main>;
}

function Missing() {
  return <main id="main" className="shell page empty"><h1>Page introuvable</h1><Link className="button" to="/">Retour à l’accueil</Link></main>;
}

function storeValue(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Navigation privée ou stockage saturé. */ }
}

function App() {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(() => storeValue('ez-guest', []).filter(line => seed.some(item => item.id === line.id) && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 10));
  const [remote, setRemote] = useState([]);
  const [favorites, setFavorites] = useState(() => storeValue('ez-favorites', []));
  const [toast, setToast] = useState('');
  const [updating, setUpdating] = useState(false);
  const timer = useRef();
  const lock = useRef(false);
  const location = useLocation();
  useEffect(() => { if (!location.hash) window.scrollTo(0, 0); }, [location.pathname]);
  const notify = useCallback(message => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(''), 4000);
  }, []);
  const refresh = useCallback(async () => {
    const { user } = await api('auth');
    if (user) {
      const { lines } = await api('cart');
      setRemote(lines);
    } else setRemote([]);
    setUser(user);
  }, []);
  useEffect(() => { refresh().catch(error => notify(error.message)); return () => clearTimeout(timer.current); }, [refresh, notify]);
  useEffect(() => persist('ez-guest', guest), [guest]);
  useEffect(() => persist('ez-favorites', favorites), [favorites]);
  async function mergeCart() {
    const remaining = [];
    for (const line of guest) {
      try { await api('cart', { method: 'PUT', body: { id: line.id, quantity: line.quantity, increment: true } }); }
      catch { remaining.push(line); }
    }
    setGuest(remaining);
    return remaining.length;
  }
  async function update(product, quantity, increment = false) {
    if (lock.current) return;
    lock.current = true;
    setUpdating(true);
    try {
      if (user) {
        const { lines } = await api('cart', { method: 'PUT', body: { id: product.id, quantity, increment } });
        setRemote(lines);
      } else {
        const next = increment ? (guest.find(item => item.id === product.id)?.quantity ?? 0) + quantity : quantity;
        if (next > Math.min(product.stock, 10)) throw new Error('Quantité indisponible.');
        setGuest(previous => [...previous.filter(item => item.id !== product.id), ...(next ? [{ id: product.id, quantity: next }] : [])]);
      }
      if (increment) notify(product.name + ' ajouté au panier.');
    } catch (error) { notify(error.message); }
    finally { lock.current = false; setUpdating(false); }
  }
  const lines = user ? remote : guest.map(line => ({ ...seed.find(item => item.id === line.id), ...line }));
  const shop = {
    add: product => update(product, 1, true),
    update, updating, lines, favorites, refresh,
    toggle: id => setFavorites(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]),
  };
  return <>
    <a className="skip" href="#main">Aller au contenu</a>
    <Header user={user} count={lines.reduce((sum, line) => sum + line.quantity, 0)}/>
    <Routes>
      <Route path="/" element={<Home shop={shop}/>}/>
      <Route path="/boutique" element={<Catalog shop={shop}/>}/>
      <Route path="/evenements" element={<EventIndex/>}/>
      <Route path="/evenements/:id" element={<Catalog shop={shop}/>}/>
      <Route path="/article/:id" element={<ProductDetail shop={shop} user={user} notify={notify}/>}/>
      <Route path="/panier" element={<Cart shop={shop} user={user} notify={notify}/>}/>
      <Route path="/compte" element={<Account user={user} refresh={refresh} notify={notify} mergeCart={mergeCart}/>}/>
      <Route path="/conditions" element={<Legal/>}/>
      <Route path="/confidentialite" element={<Legal privacy/>}/>
      <Route path="*" element={<Missing/>}/>
    </Routes>
    <Footer/>
    <div className={'toast ' + (toast ? 'shown' : '')} role="status" aria-live="polite">{toast && <><span>{toast}</span><button className="icon-btn" aria-label="Fermer la notification" onClick={() => setToast('')}><X size={16}/></button></>}</div>
  </>;
}

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><App/></BrowserRouter></StrictMode>);
