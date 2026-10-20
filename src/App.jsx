import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import appConfig from './config/app.config.js';
import traits from './config/traits.config.js';
import breeds from './data/breeds.json';
import interests from './data/interests.json';
import prompts from './data/prompts.json';
import dateSpots from './data/dateSpots.json';
import lookingForOptions from './data/lookingFor.json';
import { likeBack, rankForDiscover, sniffScore } from './engine/matching.js';
import { openingMessage, selectReply, suggestReplies, toBark, typingDelayMs } from './engine/chat.js';
import { seeded } from './engine/rng.js';
import { clearState } from './state/persistence.js';
import { useAppStore } from './state/store.js';
import { Avatar, Badge, BoneButton, Button, Chip, EmptyState, HeartButton, Icon, PassButton, ProgressBar, Sheet, TabBar } from './components/UI.jsx';

const breedLabel = (breed) => breeds.find((item) => item.id === breed)?.label || breed.replaceAll('-', ' ');
const promptQuestion = (id) => prompts.find((item) => item.id === id)?.question || 'A little about me';
const timeLabel = (timestamp) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timestamp);

function Layout() {
  const { state } = useAppStore();
  const location = useLocation();
  const hideTabs = location.pathname.startsWith('/onboarding') || location.pathname === '/welcome';
  return <div className="app-frame">
    <main className={`screen ${hideTabs ? 'screen--full' : ''}`}><Outlet /></main>
    {!hideTabs && <TabBar state={state} />}
  </div>;
}

function MatchOverlay({ dog, onClose, onMessage }) {
  return <div className="match-overlay" role="dialog" aria-modal="true" aria-labelledby="match-heading">
    <button className="icon-button match-overlay__close" onClick={onClose} aria-label="Keep sniffing"><Icon name="close" /></button>
    <div className="match-photos"><img src={dog.photos[0]} alt={`${dog.name} smiling`} /><img src={dog.photos[1]} alt={`${dog.name} out for a walk`} /></div>
    <span className="eyebrow">A very good thing just happened</span>
    <h1 id="match-heading">It’s a match!</h1>
    <p>You and {dog.name}, {dog.ageDogYears} dog years and {dog.heightPaws} paws tall, have a mutual tail wag.</p>
    <Button onClick={onMessage}>Send a message</Button>
    <Button variant="quiet" onClick={onClose}>Keep sniffing</Button>
  </div>;
}

function App() {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const matchDog = state.newMatch ? state.dogs.find((dog) => dog.id === state.newMatch) : null;
  const closeMatch = () => dispatch({ type: 'DISMISS_MATCH' });
  return <>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to={state.profile ? '/discover' : '/welcome'} replace />} />
        <Route path="/welcome" element={state.profile ? <Navigate to="/discover" replace /> : <Welcome />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/discover" element={state.profile ? <Discover /> : <Navigate to="/welcome" replace />} />
        <Route path="/standouts" element={state.profile ? <StandoutsScreen /> : <Navigate to="/welcome" replace />} />
        <Route path="/likes" element={state.profile ? <LikesScreen /> : <Navigate to="/welcome" replace />} />
        <Route path="/matches" element={state.profile ? <MatchesScreen /> : <Navigate to="/welcome" replace />} />
        <Route path="/chat/:dogId" element={state.profile ? <ChatScreen /> : <Navigate to="/welcome" replace />} />
        <Route path="/dog/:dogId" element={state.profile ? <DogScreen /> : <Navigate to="/welcome" replace />} />
        <Route path="/me" element={state.profile ? <MyProfile /> : <Navigate to="/welcome" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    {matchDog && <MatchOverlay dog={matchDog} onClose={closeMatch} onMessage={() => { closeMatch(); navigate(`/chat/${matchDog.id}`); }} />}
  </>;
}

function Welcome() {
  return <div className="welcome">
    <video
      className="welcome__video"
      src="https://videos.pexels.com/video-files/37846969/16054373_2560_1440_60fps.mp4"
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    />
    <div className="wordmark"><span className="wordmark__mark">h</span><span>{appConfig.name}</span></div>
    <div className="welcome__art" aria-hidden="true"><span>🐕</span><i>♡</i><b>🐶</b></div>
    <h1>{appConfig.tagline}</h1>
    <p className="welcome__copy">Meet the four-legged friend who gets your whole deal.</p>
    <Link className="button button--primary" to="/onboarding">Get started <span aria-hidden="true">→</span></Link>
    <small>Made by Aryan Pal.</small>
  </div>;
}

const stepIds = ['name', 'age', 'breed', 'photos', 'vibe', 'interests', 'lookingFor', 'prompts', 'preview'];
const stepTitles = {
  name: 'What’s your good dog name?',
  age: 'How many dog years?',
  breed: 'What kind of good dog are you?',
  photos: 'Pick your best angles',
  vibe: 'What’s your general vibe?',
  interests: 'What gets your tail wagging?',
  lookingFor: 'What are you hoping to find?',
  prompts: 'A little more about you',
  preview: 'Looking pretty paw-fect',
};

function Onboarding() {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const editMode = new URLSearchParams(useLocation().search).get('edit') === '1';
  const profile = state.profile;
  const initial = editMode && profile ? profile : {
    id: 'me', name: '', ageDogYears: 3, breed: '', heightPaws: 4, photos: [], prompts: [],
    traits: Object.fromEntries(traits.map((trait) => [trait.id, 5])), likes: [], dislikes: [], lookingFor: 'playdates',
  };
  const [form, setForm] = useState(initial);
  const [selectedPrompts, setSelectedPrompts] = useState(initial.prompts.map((item) => item.promptId));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  if (profile && !editMode && !saving) return <Navigate to="/me" replace />;
  const isValid = (id) => {
    if (id === 'name') return form.name.trim().length > 0;
    if (id === 'age') return form.ageDogYears >= 1 && form.ageDogYears <= 20 && form.heightPaws >= 1;
    if (id === 'breed') return Boolean(form.breed);
    if (id === 'photos') return form.photos.length >= 3 && form.photos.length <= 6;
    if (id === 'interests') return form.likes.length > 0;
    if (id === 'lookingFor') return Boolean(form.lookingFor);
    if (id === 'prompts') return selectedPrompts.length === 3 && selectedPrompts.every((promptId) => form.prompts.some((item) => item.promptId === promptId && item.answer.trim()));
    return true;
  };
  const change = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const togglePhoto = (photo) => {
    const current = form.photos;
    change('photos', current.includes(photo) ? current.filter((item) => item !== photo) : current.length < 6 ? [...current, photo] : current);
  };
  const toggleInterest = (group, id) => {
    const current = form[group];
    change(group, current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const updateAnswer = (promptId, answer) => {
    const current = form.prompts.filter((item) => item.promptId !== promptId);
    change('prompts', [...current, { promptId, answer }]);
  };
  const next = () => {
    if (!isValid(stepIds[step])) return;
    if (step < stepIds.length - 1) setStep(step + 1);
    else {
      setSaving(true);
      dispatch({ type: 'SAVE_PROFILE', profile: { ...form, id: 'me', name: form.name.trim() }, at: Date.now() });
      navigate(editMode ? '/me' : '/discover', { replace: true });
    }
  };
  const back = () => step > 0 ? setStep(step - 1) : navigate(editMode ? '/me' : '/welcome');
  const stepId = stepIds[step];
  const breed = breeds.find((item) => item.id === form.breed);
  const renderStep = () => {
    if (stepId === 'name') return <input autoFocus className="onboard-input" value={form.name} maxLength={24} placeholder="Your name" aria-label="Your name" onChange={(event) => change('name', event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && isValid(stepId)) next(); }} />;
    if (stepId === 'age') return <div className="field-stack">
      <label className="range-field"><span>{form.ageDogYears} dog years old</span><input type="range" min="1" max="20" value={form.ageDogYears} onChange={(event) => change('ageDogYears', Number(event.target.value))} /></label>
      <label className="range-field"><span>{form.heightPaws} paws tall</span><input type="range" min="2" max="10" value={form.heightPaws} onChange={(event) => change('heightPaws', Number(event.target.value))} /></label>
    </div>;
    if (stepId === 'breed') return <div className="choice-grid breed-grid">{breeds.map((item) => <button type="button" className={`breed-choice ${form.breed === item.id ? 'is-selected' : ''}`} key={item.id} onClick={() => { change('breed', item.id); change('photos', []); }}><img src={item.photos[0]} alt={`${item.label} illustration`} /><span>{item.label}</span></button>)}</div>;
    if (stepId === 'photos') return <><p className="field-note">{form.photos.length}/6 selected · choose at least 3; first is your main photo.</p><div className="photo-picker">{(breed?.photos || []).map((photo, index) => <button type="button" className={`photo-picker__item ${form.photos.includes(photo) ? 'is-selected' : ''}`} key={photo} onClick={() => togglePhoto(photo)} aria-label={`${form.photos.includes(photo) ? 'Remove' : 'Select'} gallery photo ${index + 1}`}><img src={photo} alt={`${breedLabel(form.breed)} gallery option ${index + 1}`} /><span>{form.photos.indexOf(photo) === 0 ? 'Main photo' : form.photos.includes(photo) ? 'Selected' : '＋'}</span></button>)}</div></>;
    if (stepId === 'vibe') return <div className="field-stack">{traits.map((trait) => <label className="range-field" key={trait.id}><span>{trait.label} <small>{trait.description}</small></span><input type="range" min="1" max="10" value={form.traits[trait.id]} onChange={(event) => change('traits', { ...form.traits, [trait.id]: Number(event.target.value) })} /></label>)}</div>;
    if (stepId === 'interests') return <div className="field-stack"><section><h3>I’m into</h3><div className="chip-group">{interests.map((item) => <Chip key={item.id} selected={form.likes.includes(item.id)} onClick={() => toggleInterest('likes', item.id)}>{item.emoji} {item.label}</Chip>)}</div></section><section><h3>Not my thing <small>(optional)</small></h3><div className="chip-group">{interests.map((item) => <Chip key={item.id} selected={form.dislikes.includes(item.id)} onClick={() => toggleInterest('dislikes', item.id)}>{item.emoji} {item.label}</Chip>)}</div></section></div>;
    if (stepId === 'lookingFor') return <div className="choice-list">{lookingForOptions.map((option) => <button type="button" key={option.id} className={`choice-row ${form.lookingFor === option.id ? 'is-selected' : ''}`} onClick={() => change('lookingFor', option.id)}>{option.label}<span>{form.lookingFor === option.id ? '✓' : '○'}</span></button>)}</div>;
    if (stepId === 'prompts') return <div className="field-stack"><p className="field-note">Pick three prompts. Answers can be up to 120 characters.</p>{prompts.map((prompt) => {
      const selected = selectedPrompts.includes(prompt.id);
      const answer = form.prompts.find((item) => item.promptId === prompt.id)?.answer || '';
      return <section className={`prompt-editor ${selected ? 'is-selected' : ''}`} key={prompt.id}>
        <button type="button" className="prompt-editor__title" onClick={() => {
          if (selected) { setSelectedPrompts(selectedPrompts.filter((id) => id !== prompt.id)); change('prompts', form.prompts.filter((item) => item.promptId !== prompt.id)); }
          else if (selectedPrompts.length < 3) { setSelectedPrompts([...selectedPrompts, prompt.id]); updateAnswer(prompt.id, answer || prompt.suggestions[0]); }
        }} aria-pressed={selected}>{selected ? '☑' : '□'} {prompt.question}</button>
        {selected && <><select value={prompt.suggestions.includes(answer) ? answer : ''} aria-label={`Suggested answer for ${prompt.question}`} onChange={(event) => updateAnswer(prompt.id, event.target.value)}><option value="">Choose an idea or write your own</option>{prompt.suggestions.map((suggestion) => <option key={suggestion} value={suggestion}>{suggestion}</option>)}</select><textarea value={answer} maxLength={120} placeholder="Write your answer..." onChange={(event) => updateAnswer(prompt.id, event.target.value)} aria-label={`Answer: ${prompt.question}`} /></>}
      </section>;
    })}</div>;
    return <div className="preview-card"><ProfileFeed dog={{ ...form, name: form.name || 'Your name', ageDogYears: Number(form.ageDogYears), breed: form.breed || 'mixed-breed', sizeLabel: 'Good size', location: 'Your favourite park', verified: false }} owner /></div>;
  };
  const hasVideoBackground = ['name', 'age', 'breed', 'photos', 'vibe', 'interests', 'lookingFor', 'prompts'].includes(stepId);
  const onboardingVideo = stepId === 'breed'
    ? 'https://videos.pexels.com/video-files/35727124/15142031_1920_1080_30fps.mp4'
    : stepId === 'age'
      ? 'https://videos.pexels.com/video-files/10976377/10976377-hd_1080_1920_30fps.mp4'
      : stepId === 'photos'
        ? 'https://videos.pexels.com/video-files/5469105/5469105-hd_1920_1080_24fps.mp4'
        : stepId === 'vibe'
          ? 'https://videos.pexels.com/video-files/35290087/14951300_1440_2560_30fps.mp4'
          : stepId === 'interests'
            ? 'https://videos.pexels.com/video-files/34322940/14541096_1440_2560_30fps.mp4'
            : stepId === 'lookingFor'
              ? 'https://videos.pexels.com/video-files/28638777/12438622_1920_1080_50fps.mp4'
              : stepId === 'prompts'
                ? 'https://videos.pexels.com/video-files/37191856/15755503_1440_2560_30fps.mp4'
                : 'https://videos.pexels.com/video-files/36221724/15361176_2560_1440_30fps.mp4';
  return <div className={`onboarding ${hasVideoBackground ? 'onboarding--video-step' : ''}`}>
    {hasVideoBackground && <video
      className="onboarding__video"
      src={onboardingVideo}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    />}
    <header className="onboarding__top"><button className="icon-button" aria-label="Go back" onClick={back}><Icon name="back" /></button><ProgressBar value={step + 1} max={stepIds.length} /><span>{step + 1}/{stepIds.length}</span></header>
    <section className="onboarding__content" key={stepId}><span className="eyebrow">{editMode ? 'Your profile' : `Step ${step + 1}`}</span><h1>{stepTitles[stepId]}</h1>{renderStep()}</section>
    <footer className="onboarding__bottom"><button className="next-button" disabled={!isValid(stepId)} onClick={next} aria-label={step === stepIds.length - 1 ? 'Finish profile' : 'Continue'}>{step === stepIds.length - 1 ? '✓' : '→'}</button></footer>
  </div>;
}

function ProfileFeed({ dog, owner = false, onLike }) {
  const promptsList = dog.prompts || [];
  return <div className="profile-feed">
    {dog.photos.map((photo, index) => <React.Fragment key={`photo-${index}`}>
      <article className={`profile-photo ${index === 0 ? 'profile-photo--hero' : ''}`}>
        <img src={photo} alt={`${dog.name}, ${breedLabel(dog.breed)} photo ${index + 1}`} />
        {index === 0 && <div className="profile-photo__caption"><h2>{dog.name}, {dog.ageDogYears}</h2><p><Icon name="location" size={16} /> {dog.location || 'Nearby'}</p></div>}
        {!owner && onLike && <HeartButton onClick={() => onLike(`photo:${index}`)} />}
      </article>
      {promptsList[index] && <article className="prompt-card"><span className="eyebrow">{promptQuestion(promptsList[index].promptId)}</span><p>{promptsList[index].answer}</p>{!owner && onLike && <HeartButton onClick={() => onLike(`prompt:${promptsList[index].promptId}`)} />}</article>}
    </React.Fragment>)}
    <VitalsRow dog={dog} />
    {dog.likes?.length > 0 && <section className="feed-section"><span className="eyebrow">Into</span><div className="chip-group">{dog.likes.map((id) => { const item = interests.find((interest) => interest.id === id); return item && <span key={id} className="chip chip--static">{item.emoji} {item.label}</span>; })}</div></section>}
    {dog.dislikes?.length > 0 && <section className="feed-section"><span className="eyebrow">Dealbreakers</span><div className="chip-group">{dog.dislikes.map((id) => { const item = interests.find((interest) => interest.id === id); return item && <Badge key={id} tone="danger">{item.emoji} {item.label}</Badge>; })}</div></section>}
  </div>;
}

function VitalsRow({ dog }) {
  return <section className="vitals"><div><span className="eyebrow">Dog years</span><strong>{dog.ageDogYears}</strong></div><div><span className="eyebrow">Height</span><strong>{dog.heightPaws} paws</strong></div><div><span className="eyebrow">Breed</span><strong>{breedLabel(dog.breed)}</strong></div><div><span className="eyebrow">Looking for</span><strong>{lookingForOptions.find((option) => option.id === dog.lookingFor)?.label || 'Good company'}</strong></div></section>;
}

function Discover() {
  const { state, dispatch } = useAppStore();
  const ranked = useMemo(() => rankForDiscover(state.profile, state.dogs, state.seenIds, state.lastDiscoverId), [state.profile, state.dogs, state.seenIds, state.lastDiscoverId]);
  const [sheet, setSheet] = useState(null);
  const [comment, setComment] = useState('');
  const dog = ranked[0];
  const swipe = (action, bone = false) => {
    if (!dog) return;
    const at = Date.now();
    const result = action === 'like' ? likeBack(state.profile, dog, { bone }) : { willMatch: false };
    dispatch({ type: 'SWIPE', dogId: dog.id, action, bone, at, matchAt: result.willMatch ? at + result.delayMs : 0, comment: action === 'like' ? comment : '', targetRef: action === 'like' ? sheet : '' });
    setSheet(null);
    setComment('');
  };
  if (!dog) return   <div className="screen-content"><header className="page-header"><span className="eyebrow">{appConfig.name}</span><h1>Discover</h1></header><EmptyState title="You’ve sniffed everyone nearby." body="Check back later for more good dogs." /></div>;
  return <div className="screen-content discover-screen">
    <header className="page-header"><div><span className="eyebrow">{appConfig.name} · DISCOVER</span><h1>A good match might be close.</h1></div><Badge tone="score">{sniffScore(state.profile, dog)}% sniff match</Badge></header>
    <div className="discover-profile"><ProfileFeed dog={dog} onLike={setSheet} /></div>
    <div className="floating-pass"><PassButton onClick={() => swipe('pass')} /></div>
    {sheet && <Sheet title="Send a little hello" onClose={() => setSheet(null)}>
      <div className="like-target"><span className="eyebrow">Your note on</span><p>{sheet.startsWith('prompt:') ? promptQuestion(sheet.slice(7)) : `Photo ${Number(sheet.split(':')[1]) + 1}`}</p></div>
      <label className="field-label" htmlFor="like-comment">Add a comment <span>(optional)</span></label>
      <textarea id="like-comment" className="text-area" maxLength={140} placeholder="Say something that makes their tail wag..." value={comment} onChange={(event) => setComment(event.target.value)} />
      <Button onClick={() => swipe('like')}>Send like</Button>
      <BoneButton disabled={state.bones.remaining < 1} title={state.bones.remaining < 1 ? `Next Bone in ${Math.max(1, Math.ceil((state.bones.resetAt - Date.now()) / 3600000))}h` : 'Send a Bone instead'} onClick={() => swipe('like', true)}>
        Send a Bone instead <small>{state.bones.remaining} left</small>
      </BoneButton>
      <p className="sheet__hint">A Bone gives your like a little extra tail wag.</p>
    </Sheet>}
  </div>;
}

function StandoutsScreen() {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const touchStart = useRef(null);
  const suppressCardClick = useRef(false);
  const standouts = useMemo(
    () => {
      const rankedDogs = rankForDiscover(state.profile, state.dogs, state.seenIds);
      const guspy = rankedDogs.find((dog) => dog.id === 'guspy') ?? state.dogs.find((dog) => dog.id === 'guspy');
      if (guspy) {
        const guspyIndex = rankedDogs.findIndex((dog) => dog.id === 'guspy');
        if (guspyIndex >= 0) rankedDogs.splice(guspyIndex, 1);
        rankedDogs.unshift(guspy);
      }
      return rankedDogs.slice(0, 4);
    },
    [state.profile, state.dogs, state.seenIds],
  );
  const index = Math.min(selectedIndex, Math.max(0, standouts.length - 1));
  const dog = standouts[index];
  const move = (direction) => setSelectedIndex((current) => Math.max(0, Math.min(standouts.length - 1, current + direction)));
  const sendBone = () => {
    if (!dog || state.bones.remaining < 1) return;
    const at = Date.now();
    const result = likeBack(state.profile, dog, { bone: true });
    dispatch({
      type: 'SWIPE',
      dogId: dog.id,
      action: 'like',
      bone: true,
      at,
      matchAt: result.willMatch ? at + result.delayMs : 0,
      targetRef: 'photo:0',
    });
  };
  const handlePointerDown = (event) => {
    if (event.target.closest('button')) return;
    touchStart.current = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = (event) => {
    if (!touchStart.current) return;
    const deltaX = event.clientX - touchStart.current.x;
    const deltaY = event.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      suppressCardClick.current = true;
      window.setTimeout(() => { suppressCardClick.current = false; }, 0);
      move(deltaX < 0 ? 1 : -1);
    }
  };

  return <div className="screen-content standouts-screen">
    <header className="standouts-header">
      <div><span className="eyebrow">A little extra tail wag</span><h1>Standouts</h1></div>
      <div className="standouts-header__navigation">
        <button className="icon-button" type="button" aria-label="Previous standout profile" onClick={() => move(-1)} disabled={index === 0}>‹</button>
        <span aria-live="polite">{dog ? `${index + 1} / ${standouts.length}` : '0 / 0'}</span>
        <button className="icon-button" type="button" aria-label="Next standout profile" onClick={() => move(1)} disabled={index >= standouts.length - 1}>›</button>
      </div>
    </header>
    {dog
      ? <div
        className="standouts-carousel"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { touchStart.current = null; }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') move(-1);
          if (event.key === 'ArrowRight') move(1);
        }}
        tabIndex={0}
        aria-label="Featured dog profiles. Swipe or use arrow keys to browse."
      >
        {standouts.map((profile, profileIndex) => {
          const position = profileIndex - index;
          if (Math.abs(position) > 1) return null;
          return <article
            className={`standout-profile ${position === 0 ? 'standout-profile--active' : 'standout-profile--peek'}`}
            key={profile.id}
            style={{ transform: `translateX(calc(-50% + ${position * 100}%))` }}
            aria-hidden={position !== 0}
            role={position === 0 ? 'link' : undefined}
            tabIndex={position === 0 ? 0 : undefined}
            aria-label={position === 0 ? `View ${profile.name}'s full profile` : undefined}
            onClick={(event) => {
              if (suppressCardClick.current || event.target.closest('button')) return;
              navigate(`/dog/${profile.id}`, { state: { fromStandouts: true } });
            }}
            onKeyDown={(event) => {
              if (position !== 0 || !['Enter', ' '].includes(event.key)) return;
              event.preventDefault();
              navigate(`/dog/${profile.id}`);
            }}
          >
            <img className="standout-profile__image" src={profile.photos[0]} alt={`${profile.name}, ${breedLabel(profile.breed)}`} />
            <div className="standout-profile__shade" />
            {position === 0 && <>
              <div className="standout-profile__top">
                <Badge tone="score">{sniffScore(state.profile, profile)}% sniff match</Badge>
                {profile.verified && <Badge><Icon name="verified" size={15} /> Verified</Badge>}
              </div>
              <div className="standout-profile__details">
                <span className="eyebrow">{breedLabel(profile.breed)} · {profile.heightPaws} paws · {profile.location}</span>
                <h2>{profile.name}, {profile.ageDogYears}</h2>
                {profile.prompts[0] && <div className="standout-profile__prompt">
                  <span>{promptQuestion(profile.prompts[0].promptId)}</span>
                  <p>{profile.prompts[0].answer}</p>
                </div>}
                <BoneButton
                  className="standout-profile__bone"
                  disabled={state.bones.remaining < 1}
                  title={state.bones.remaining < 1 ? `Your next Bone is available in ${Math.max(1, Math.ceil((state.bones.resetAt - Date.now()) / 3600000))}h` : `Send ${profile.name} a Bone`}
                  onClick={sendBone}
                >
                  <span>Send a Bone</span><small>{state.bones.remaining} left today</small>
                </BoneButton>
              </div>
            </>}
          </article>;
        })}
      </div>
      : <EmptyState title="No standouts right now" body="You’ve met all the featured pups. Check back after more dogs join the pack." />}
  </div>;
}

function LikesScreen() {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const likes = Object.entries(state.inboundLikes)
    .filter(([, like]) => !['passed', 'matched'].includes(like.status))
    .map(([id, like]) => ({ dog: state.dogs.find((item) => item.id === id), like }))
    .filter((item) => item.dog)
    .sort((a, b) => Number(b.like.bone) - Number(a.like.bone));
  const bones = likes.filter(({ like }) => like.bone);
  const regular = likes.filter(({ like }) => !like.bone);
  const likeBackNow = (dog) => {
    dispatch({ type: 'LIKE_BACK', dogId: dog.id, at: Date.now() });
  };
  const rows = (list) => list.map(({ dog, like }) => <article className={`like-card ${like.bone ? 'like-card--bone' : ''}`} key={dog.id}>
    <button className="like-card__profile" onClick={() => navigate(`/dog/${dog.id}`)} aria-label={`View ${dog.name}'s profile`}>
      <img src={dog.photos[0]} alt={`${dog.name}, ${breedLabel(dog.breed)}`} />
      <span className="like-card__details"><strong>{dog.name} · {dog.ageDogYears} dog years · {dog.heightPaws} paws</strong><span>{like.comment}</span></span>
      {like.bone && <span className="like-card__bone"><Icon name="bone" size={17} /></span>}
    </button>
    <div className="like-card__actions"><Button variant="secondary" onClick={() => likeBackNow(dog)}>Like back</Button><Button variant="quiet" onClick={() => dispatch({ type: 'PASS_INBOUND', dogId: dog.id })}>Pass</Button></div>
  </article>);
  return <div className="screen-content"><header className="page-header"><span className="eyebrow">A little admirer alert</span><h1>Likes You</h1><p>Good dogs who already think you're pretty great.</p></header>
    {bones.length > 0 && <section className="list-section"><h2><Icon name="bone" /> Bones <small>{bones.length}</small></h2><div className="like-list">{rows(bones)}</div></section>}
    {regular.length > 0 && <section className="list-section"><h2>Likes <small>{regular.length}</small></h2><div className="like-list">{rows(regular)}</div></section>}
    {!likes.length && <EmptyState title="No new tail wags just yet" body="Keep sniffing around. Someone good may be on their way." />}
  </div>;
}

function MatchesScreen() {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const matched = Object.entries(state.matches).map(([id, match]) => ({ dog: state.dogs.find((item) => item.id === id), match, chat: state.chats[id] || [] })).filter((item) => item.dog);
  matched.sort((a, b) => (b.chat.at(-1)?.at || b.match.matchedAt) - (a.chat.at(-1)?.at || a.match.matchedAt));
  const fresh = matched.filter(({ chat }) => chat.length === 0);
  const conversations = matched.filter(({ chat }) => chat.length > 0);
  const row = ({ dog, chat }) => {
    const last = chat.at(-1);
    const translated = state.settings.barkTranslateDefault;
    const message = last ? (last.from === 'dog' && !translated ? last.bark : last.text) : 'Your new match is waiting to say hello.';
    return <button type="button" className="match-row" key={dog.id} onClick={() => navigate(`/chat/${dog.id}`)}>
      <Avatar dog={dog} /><span className="match-row__copy"><strong>{dog.name} · {dog.ageDogYears} dog years · {dog.heightPaws} paws</strong><span>{message}</span></span>
      {chat.some((entry) => entry.from === 'dog' && !entry.read) && <span className="unread-dot" aria-label="Unread message" />}
    </button>;
  };
  return <div className="screen-content"><header className="page-header"><span className="eyebrow">Mutual tail wags</span><h1>Matches</h1><p>Your good dogs are right here.</p></header>
    {fresh.length > 0 && <section className="list-section"><h2>New matches</h2><div className="new-matches">{fresh.map(({ dog }) => <button type="button" key={dog.id} onClick={() => navigate(`/chat/${dog.id}`)}><Avatar dog={dog} size="large" /><span>{dog.name}</span></button>)}</div></section>}
    {conversations.length > 0 && <section className="list-section"><h2>Messages</h2><div className="match-list">{conversations.map(row)}</div></section>}
    {matched.length === 0 && <EmptyState title="Your next good thing is out there" body="Find a dog who gets your whole deal in Discover." action={<Link className="button button--primary" to="/discover">Go to Discover</Link>} />}
  </div>;
}

function DogScreen() {
  const { dogId } = useParams();
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const dog = state.dogs.find((item) => item.id === dogId);
  if (!dog) return <NotFound />;
  const inboundLike = state.inboundLikes[dog.id];
  const inbound = inboundLike?.status === 'arrived';
  const fromStandouts = location.state?.fromStandouts === true;
  const sendBone = () => {
    if (state.bones.remaining < 1) return;
    const at = Date.now();
    const result = likeBack(state.profile, dog, { bone: true });
    dispatch({
      type: 'SWIPE',
      dogId: dog.id,
      action: 'like',
      bone: true,
      at,
      matchAt: result.willMatch ? at + result.delayMs : 0,
      targetRef: 'photo:0',
    });
  };
  return <div className="screen-content detail-screen"><header className="detail-top"><button className="icon-button" onClick={() => navigate(-1)} aria-label="Go back"><Icon name="back" /></button><span className="eyebrow">DOG PROFILE</span><span /></header>
    {inbound && <div className="inbound-note"><span className="eyebrow">They said</span><p>“{inboundLike.comment}”</p></div>}
    <ProfileFeed dog={dog} />
    {fromStandouts
      ? <div className="detail-actions detail-actions--bone"><BoneButton className="dog-profile-bone" disabled={state.bones.remaining < 1} title={state.bones.remaining < 1 ? `Your next Bone is available in ${Math.max(1, Math.ceil((state.bones.resetAt - Date.now()) / 3600000))}h` : `Send ${dog.name} a Bone`} onClick={sendBone}><span>Send a Bone</span><small>{state.bones.remaining} left today</small></BoneButton></div>
      : inbound && <div className="detail-actions"><Button onClick={() => dispatch({ type: 'LIKE_BACK', dogId: dog.id, at: Date.now() })}>Like back</Button><Button variant="secondary" onClick={() => { dispatch({ type: 'PASS_INBOUND', dogId: dog.id }); navigate('/likes'); }}>Pass</Button></div>}
  </div>;
}

function MyProfile() {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const profile = state.profile;
  return <div className="screen-content my-profile"><header className="page-header page-header--split"><div><span className="eyebrow">YOUR PROFILE</span><h1>Hi, {profile.name}.</h1></div><Button variant="secondary" onClick={() => navigate('/onboarding?edit=1')}>Edit</Button></header>
    <ProfileFeed dog={{ ...profile, location: 'Your favourite park', sizeLabel: 'Good size' }} owner />
    <section className="settings-section"><span className="eyebrow">Settings</span><label className="setting-row"><span><strong>Bark translation</strong><small>Show the human words in chat by default</small></span><input type="checkbox" checked={state.settings.barkTranslateDefault} onChange={(event) => dispatch({ type: 'SAVE_SETTINGS', settings: { barkTranslateDefault: event.target.checked } })} /></label>
      <Button variant="danger" onClick={() => { if (window.confirm('This clears your profile, matches, and chats from this browser. Start over?')) { clearState(); window.location.assign('/welcome'); } }}>Reset app data</Button>
    </section>
  </div>;
}

function ChatScreen() {
  const { dogId } = useParams();
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const dog = state.dogs.find((item) => item.id === dogId);
  const chat = state.chats[dogId] || [];
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [translationOverrides, setTranslationOverrides] = useState({});
  const [planner, setPlanner] = useState(false);
  useEffect(() => {
    if (!state.matches[dogId]) navigate('/matches', { replace: true });
  }, [dogId, navigate, state.matches]);
  useEffect(() => {
    dispatch({ type: 'MARK_READ', dogId });
  }, [dispatch, dogId, chat.length]);
  useEffect(() => {
    if (!dog || chat.length > 0) return undefined;
    setTyping(true);
    const timer = window.setTimeout(() => {
      const text = openingMessage(dog, state.profile);
      dispatch({ type: 'APPEND_CHAT', dogId, message: { id: `${dogId}-${Date.now()}`, from: 'dog', text, bark: toBark(text, undefined, seeded(`${dogId}:opener`)), at: Date.now(), read: true } });
      setTyping(false);
    }, 1300);
    return () => window.clearTimeout(timer);
  }, [dog, dogId, chat.length, dispatch, state.profile]);
  if (!dog) return <NotFound />;
  const send = (text = input) => {
    const clean = text.trim();
    if (!clean || typing) return;
    const at = Date.now();
    const userMessage = { id: `${dogId}-${at}`, from: 'me', text: clean, bark: '', at };
    const updatedHistory = [...chat, userMessage];
    dispatch({ type: 'APPEND_CHAT', dogId, message: userMessage });
    setInput('');
    setTyping(true);
    const reply = selectReply(dog, state.profile, clean, updatedHistory);
    const delay = typingDelayMs(dog, reply.text);
    window.setTimeout(() => {
      dispatch({ type: 'APPEND_CHAT', dogId, message: { id: `${dogId}-${Date.now()}`, from: 'dog', text: reply.text, bark: toBark(reply.text, undefined, seeded(`${dogId}:${updatedHistory.length}`)), at: Date.now(), read: false } });
      setTyping(false);
    }, delay);
  };
  const suggestions = suggestReplies(chat, dog);
  const dates = dateSpots;
  return <div className="chat-screen">
    <header className="chat-header"><button className="icon-button" onClick={() => navigate('/matches')} aria-label="Back to matches"><Icon name="back" /></button><button className="chat-header__profile" onClick={() => navigate(`/dog/${dog.id}`)}><Avatar dog={dog} /><span><strong>{dog.name}</strong><small>{dog.ageDogYears} dog years · {dog.heightPaws} paws tall</small></span></button><button className="icon-button" onClick={() => navigate(`/dog/${dog.id}`)} aria-label={`View ${dog.name}'s profile`}>···</button></header>
    <div className="chat-messages" aria-live="polite">
      <div className="chat-date">You matched with {dog.name}</div>
      {chat.map((message) => {
        const isTranslated = message.from === 'dog' && (translationOverrides[message.id] ?? state.settings.barkTranslateDefault);
        return <div key={message.id} className={`message-row ${message.from === 'me' ? 'message-row--mine' : ''}`}>
          <div className={`chat-bubble ${message.from === 'me' ? 'chat-bubble--mine' : ''}`}>
            <p>{message.from === 'dog' && !isTranslated ? message.bark : message.text}</p>
            {message.from === 'dog' && <button className="translate-button" onClick={() => setTranslationOverrides((previous) => ({ ...previous, [message.id]: !isTranslated }))}>{isTranslated ? 'Show barks' : 'Translate'}</button>}
            <time>{timeLabel(message.at)}</time>
          </div>
        </div>;
      })}
      {typing && <div className="typing-indicator">{dog.name} is typing<span> ···</span></div>}
      {planner && <section className="date-planner"><span className="eyebrow">THE DATE PLANNER</span><h3>Pick your first sniff spot</h3><div>{dates.map((date) => <button key={date.name} onClick={() => { setPlanner(false); send(`How about a date at ${date.name.toLowerCase()}?`); }}>{date.emoji} {date.name}</button>)}</div></section>}
    </div>
    <div className="chat-compose">
      {chat.length > 0 && <div className="quick-replies">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => send(suggestion)} disabled={typing}>{suggestion}</button>)}</div>}
      <button className="planner-launch" onClick={() => setPlanner(!planner)} aria-expanded={planner} disabled={typing}>Plan a dog date ✨</button>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Message ${dog.name}...`} aria-label="Message" disabled={typing} /><button type="submit" disabled={!input.trim() || typing} aria-label="Send message"><Icon name="send" /></button></form>
    </div>
  </div>;
}

function NotFound() {
  return <div className="screen-content"><EmptyState title="This dog ran off" body="Looks like this page wandered somewhere else." action={<Link className="button button--primary" to="/discover">Back to Discover</Link>} /></div>;
}

export default App;
