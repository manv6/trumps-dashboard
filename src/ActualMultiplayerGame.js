import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
	Container, Paper, Stack, Button, Typography, Chip, Avatar, Box, Alert,
	Modal, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import ActualGameHistory from './ActualGameHistory';

// Modern card component
function PlayingCard({ value, suit, onClick, disabled, selected, small }) {
	const suitColor = suit === '♥' || suit === '♦' ? '#e53935' : '#222';
	const bgColor = selected ? '#e3f2fd' : '#fff';
	return (
		<Box
			onClick={disabled ? undefined : onClick}
			sx={{
				width: small ? 40 : 56,
				height: small ? 58 : 80,
				borderRadius: 2,
				boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
				border: selected ? '2px solid #1976d2' : '1px solid #bbb',
				background: bgColor,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'space-between',
				cursor: disabled || !onClick ? 'default' : 'pointer',
				opacity: disabled ? 0.45 : 1,
				m: 0.5,
				transition: 'border 0.2s, box-shadow 0.2s, transform 0.15s',
				'&:hover': onClick && !disabled ? { transform: 'translateY(-4px)' } : {},
				position: 'relative',
			}}
		>
			<Typography variant="body2" sx={{ color: suitColor, fontWeight: 700, pt: 0.5, fontSize: small ? '0.7rem' : undefined }}>
				{value}
			</Typography>
			<Typography variant={small ? 'h6' : 'h4'} sx={{ color: suitColor, fontWeight: 700 }}>
				{suit}
			</Typography>
			<Typography variant="body2" sx={{ color: suitColor, fontWeight: 700, pb: 0.5, fontSize: small ? '0.7rem' : undefined }}>
				{value}
			</Typography>
		</Box>
	);
}

export default function ActualMultiplayerGame({ gameId, initialGameData, onLeaveGame }) {
	const { user } = useAuth();
	const [tabIndex, setTabIndex] = useState(0);
	const [gameData, setGameData] = useState(initialGameData);
	const [actualState, setActualState] = useState(initialGameData?.actualState || null);
	const [myHand, setMyHand] = useState([]);
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState('');
	const [endResult, setEndResult] = useState(null);
	const [showEndModal, setShowEndModal] = useState(false);
	const [endModalDismissed, setEndModalDismissed] = useState(false);
	const socketRef = useRef(null);

	// Socket connection: all game logic lives on the server, we send
	// intents ('actual-action') and render the broadcast state.
	useEffect(() => {
		const socketUrl = process.env.NODE_ENV === 'development'
			? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
				? 'http://localhost:3002'
				: `http://${window.location.hostname}:3002`)
			: window.location.origin;
		const socket = io(socketUrl);
		socketRef.current = socket;

		socket.on('connect', () => {
			setConnected(true);
			socket.emit('join-game', { gameId, userId: user.id, username: user.username });
		});
		socket.on('disconnect', () => setConnected(false));
		socket.on('game-state', (game) => setGameData(game));
		socket.on('actual-state', (state) => setActualState(state));
		socket.on('your-hand', ({ hand }) => setMyHand(hand || []));
		socket.on('game-completed', (result) => {
			setEndResult(result);
			setShowEndModal(true);
		});
		socket.on('error', (msg) => setError(typeof msg === 'string' ? msg : 'Something went wrong'));
		socket.on('player-joined', () => {}); // game-state broadcast covers it

		return () => socket.disconnect();
	}, [gameId, user.id, user.username]);

	// Errors are transient hints (wrong turn, must follow suit, ...)
	useEffect(() => {
		if (!error) return;
		const t = setTimeout(() => setError(''), 4000);
		return () => clearTimeout(t);
	}, [error]);

	const sendAction = useCallback((action, payload = {}) => {
		if (socketRef.current && socketRef.current.connected) {
			socketRef.current.emit('actual-action', { gameId, action, payload });
		}
	}, [gameId]);

	// ---- Derived state ----
	const gameState = gameData?.gameState || {};
	const numPlayers = gameState.numPlayers || 4;
	const players = gameData?.players || [];
	const playerNames = players.map(p => p.username);
	const myIdx = players.findIndex(p => p.userId === user.id);
	const isHost = gameData?.hostId === user.id;
	const rounds = gameState.rounds || [];

	const phase = actualState?.phase;
	const roundIdx = actualState?.roundIdx ?? gameState.currentRound ?? 0;
	const cardsThisRound = actualState?.cardsThisRound ?? rounds[roundIdx] ?? 0;
	const turn = actualState?.turn ?? -1;
	const myTurn = turn === myIdx;
	const predictions = actualState?.predictions || [];
	const tricksWon = actualState?.tricksWon || [];
	const currentTrick = actualState?.currentTrick || [];
	const completedTrick = actualState?.completedTrick || null;
	const trumpSuit = actualState?.trumpSuit || '♠';
	const firstPlayer = actualState?.firstPlayer ?? 0;

	// Am I the last player to predict this round? Then one value is forbidden.
	const isLastPredictor = myIdx !== -1 &&
		(myIdx - firstPlayer + numPlayers) % numPlayers === numPlayers - 1;
	const sumOtherPredictions = predictions.reduce(
		(a, p, i) => a + (i !== myIdx && p !== null && p !== undefined ? p : 0), 0);
	const forbiddenPrediction = isLastPredictor ? cardsThisRound - sumOtherPredictions : null;

	// Follow-suit hint: when the trick has a lead suit and I hold it,
	// only lead-suit cards are playable (the server enforces this too).
	const leadSuit = currentTrick.length > 0 ? currentTrick[0].card.suit : null;
	const holdLeadSuit = leadSuit ? myHand.some(c => c.suit === leadSuit) : false;
	const isCardPlayable = (card) =>
		phase === 'playing' && myTurn && (!leadSuit || !holdLeadSuit || card.suit === leadSuit);

	const isCompleted = gameState.isGameCompleted || phase === 'game-over';
	const finalResult = endResult || (isCompleted ? {
		playerNames: gameData?.playerNames || playerNames,
		scores: gameData?.scores || [],
		winners: gameData?.winners || []
	} : null);

	const totalPoints = (pIdx) =>
		(gameState.playerData?.[pIdx]?.points || []).reduce((a, b) => a + (b || 0), 0);

	if (!connected) {
		return (
			<Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<Typography variant="h5">Connecting to game...</Typography>
			</Box>
		);
	}

	// ---- Waiting room (before the host starts the game) ----
	const renderWaitingRoom = () => (
		<Box sx={{ textAlign: 'center', py: 4 }}>
			<Typography variant="h5" sx={{ mb: 1 }}>🃏 Waiting for players</Typography>
			<Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
				Share the game ID <b>{gameId}</b> with your friends
			</Typography>
			<Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 4, flexWrap: 'wrap' }}>
				{Array(numPlayers).fill(null).map((_, idx) => {
					const p = players[idx];
					return (
						<Paper key={idx} sx={{ p: 2, minWidth: 120, opacity: p ? 1 : 0.5, border: p?.userId === user.id ? '2px solid #4caf50' : '1px solid #e0e0e0' }}>
							<Avatar sx={{ mx: 'auto', mb: 1, bgcolor: p ? '#1976d2' : '#bdbdbd' }}>
								{p ? p.username[0].toUpperCase() : '?'}
							</Avatar>
							<Typography variant="body2" sx={{ fontWeight: 600 }}>
								{p ? p.username : 'Waiting...'}
							</Typography>
							{p && (
								<Chip size="small" sx={{ mt: 0.5 }}
									label={p.isConnected ? 'online' : 'offline'}
									color={p.isConnected ? 'success' : 'default'} />
							)}
						</Paper>
					);
				})}
			</Stack>
			{isHost ? (
				<Button
					variant="contained" size="large"
					disabled={players.length < numPlayers}
					onClick={() => sendAction('start-game')}
				>
					{players.length < numPlayers
						? `Waiting for players (${players.length}/${numPlayers})`
						: '🚀 Start Game'}
				</Button>
			) : (
				<Typography variant="body1" color="text.secondary">
					Waiting for the host to start the game...
				</Typography>
			)}
		</Box>
	);

	// ---- Live game ----
	const renderGame = () => (
		<Box>
			{/* Round header */}
			<Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
				<Chip label={`Round ${roundIdx + 1}/${rounds.length}`} color="primary" />
				<Chip label={`${cardsThisRound} cards`} variant="outlined" />
				<Chip
					label={`${trumpSuit} Trumps (μπαλαντέρ)`}
					sx={{ fontWeight: 700, backgroundColor: '#263238', color: '#fff' }}
				/>
			</Stack>

			{/* Players strip: predictions + tricks + turn indicator */}
			<Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: 'wrap', rowGap: 1.5 }}>
				{players.map((p, idx) => (
					<Paper key={idx} sx={{
						px: 2, py: 1, minWidth: 110,
						backgroundColor: turn === idx ? '#e3f2fd' : '#fafafa',
						border: idx === myIdx ? '2px solid #4caf50' : (turn === idx ? '2px solid #1976d2' : '1px solid #e0e0e0'),
					}}>
						<Typography variant="body2" sx={{ fontWeight: 700 }}>
							{p.username}{idx === myIdx ? ' 👤' : ''}
							{turn === idx && phase !== 'game-over' ? ' ⏳' : ''}
						</Typography>
						<Typography variant="caption" display="block">
							Bid: {predictions[idx] ?? '—'} · Won: {tricksWon[idx] ?? 0}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{totalPoints(idx)} pts total
						</Typography>
					</Paper>
				))}
			</Stack>

			{/* Prediction phase */}
			{phase === 'predicting' && (
				<Box sx={{ mb: 3 }}>
					<Typography variant="h6" sx={{ mb: 1 }}>
						{myTurn ? 'Your bid: how many tricks will you win?' : `Waiting for ${playerNames[turn] || '...'} to bid`}
					</Typography>
					<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
						{[...Array(cardsThisRound + 1).keys()].map(val => {
							const forbidden = myTurn && isLastPredictor && val === forbiddenPrediction;
							return (
								<Chip
									key={val}
									label={forbidden ? `${val} 🚫` : val}
									color={predictions[myIdx] === val ? 'success' : 'default'}
									variant={predictions[myIdx] === val ? 'filled' : 'outlined'}
									onClick={myTurn && !forbidden ? () => sendAction('predict', { value: val }) : undefined}
									disabled={!myTurn || forbidden}
									sx={{ fontWeight: 600, fontSize: '1.1rem', cursor: myTurn && !forbidden ? 'pointer' : 'default' }}
								/>
							);
						})}
					</Box>
					{myTurn && isLastPredictor && forbiddenPrediction >= 0 && forbiddenPrediction <= cardsThisRound && (
						<Typography variant="caption" sx={{ color: '#d1381b', fontWeight: 700 }}>
							You bid last — the total cannot equal {cardsThisRound}, so {forbiddenPrediction} is not allowed.
						</Typography>
					)}

					{/* Show the hand during bidding so players can judge their cards */}
					<Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>Your hand</Typography>
					<Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
						{myHand.map((card) => (
							<PlayingCard
								key={`${card.suit}${card.value}`}
								value={card.value}
								suit={card.suit}
							/>
						))}
						{myHand.length === 0 && (
							<Typography variant="body2" color="text.secondary">Waiting for cards to be dealt...</Typography>
						)}
					</Box>
				</Box>
			)}

			{/* Playing phase */}
			{phase === 'playing' && (
				<Box sx={{ mb: 3 }}>
					<Typography variant="h6" sx={{ mb: 1 }}>
						{myTurn ? '🎯 Your turn — play a card' : `Waiting for ${playerNames[turn] || '...'} to play`}
					</Typography>

					{/* Current trick */}
					<Paper variant="outlined" sx={{ p: 2, mb: 2, minHeight: 110, backgroundColor: '#f0f7f0' }}>
						<Typography variant="subtitle2" sx={{ mb: 1 }}>On the table</Typography>
						{currentTrick.length === 0 ? (
							completedTrick ? (
								<Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap' }}>
									{completedTrick.trick.map((play, idx) => (
										<Box key={idx} sx={{ textAlign: 'center', opacity: 0.7 }}>
											<PlayingCard value={play.card.value} suit={play.card.suit} small
												selected={completedTrick.winner === play.playerIdx} />
											<Typography variant="caption">{playerNames[play.playerIdx]}</Typography>
										</Box>
									))}
									<Chip color="success" label={`${playerNames[completedTrick.winner]} took the trick`} />
								</Stack>
							) : (
								<Typography variant="body2" color="text.secondary">
									{playerNames[turn] || 'Someone'} leads the first trick
								</Typography>
							)
						) : (
							<Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
								{currentTrick.map((play, idx) => (
									<Box key={idx} sx={{ textAlign: 'center' }}>
										<PlayingCard value={play.card.value} suit={play.card.suit} selected={idx === 0} />
										<Typography variant="caption">{playerNames[play.playerIdx]}</Typography>
									</Box>
								))}
							</Stack>
						)}
					</Paper>

					{/* My hand */}
					<Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>Your hand</Typography>
					<Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
						{myHand.map((card, idx) => (
							<PlayingCard
								key={`${card.suit}${card.value}`}
								value={card.value}
								suit={card.suit}
								onClick={() => sendAction('play-card', { card })}
								disabled={!isCardPlayable(card)}
							/>
						))}
						{myHand.length === 0 && (
							<Typography variant="body2" color="text.secondary">No cards left this round</Typography>
						)}
					</Box>
					{leadSuit && holdLeadSuit && myTurn && (
						<Typography variant="caption" color="text.secondary">
							You must follow suit ({leadSuit})
						</Typography>
					)}
				</Box>
			)}

			{/* Score sheet */}
			<Typography variant="h6" sx={{ mt: 2, mb: 1 }}>📋 Score Sheet</Typography>
			<Box sx={{ overflowX: 'auto', mb: 2 }}>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell sx={{ fontWeight: 700 }}>Round</TableCell>
							<TableCell sx={{ fontWeight: 700 }}>Cards</TableCell>
							{playerNames.map((name, idx) => (
								<TableCell key={idx} align="center" colSpan={3}
									sx={{ fontWeight: 700, color: idx === myIdx ? '#4caf50' : '#1976d2' }}>
									{name}
								</TableCell>
							))}
						</TableRow>
						<TableRow>
							<TableCell /><TableCell />
							{playerNames.map((_, idx) => (
								<React.Fragment key={idx}>
									<TableCell align="center" sx={{ color: '#666' }}>Π</TableCell>
									<TableCell align="center" sx={{ color: '#666' }}>Μ</TableCell>
									<TableCell align="center" sx={{ color: '#666' }}>Pts</TableCell>
								</React.Fragment>
							))}
						</TableRow>
					</TableHead>
					<TableBody>
						{rounds.map((cards, rIdx) => (
							<TableRow key={rIdx} sx={{ backgroundColor: rIdx === roundIdx && !isCompleted ? '#fff9c4' : 'inherit' }}>
								<TableCell>{rIdx + 1}</TableCell>
								<TableCell>{cards}</TableCell>
								{playerNames.map((_, pIdx) => {
									const pd = gameState.playerData?.[pIdx] || {};
									const pred = rIdx === roundIdx && !isCompleted ? predictions[pIdx] : pd.predictions?.[rIdx];
									const tricks = rIdx === roundIdx && !isCompleted ? tricksWon[pIdx] : pd.tricks?.[rIdx];
									const pts = pd.points?.[rIdx];
									const hit = pts !== undefined && pd.predictions?.[rIdx] === pd.tricks?.[rIdx];
									return (
										<React.Fragment key={pIdx}>
											<TableCell align="center">{pred ?? ''}</TableCell>
											<TableCell align="center">{tricks ?? ''}</TableCell>
											<TableCell align="center" sx={{ fontWeight: 700, backgroundColor: hit ? '#e7ffd6' : 'inherit' }}>
												{pts ?? ''}
											</TableCell>
										</React.Fragment>
									);
								})}
							</TableRow>
						))}
						<TableRow sx={{ backgroundColor: '#f5f5f5' }}>
							<TableCell colSpan={2} sx={{ fontWeight: 700 }}>Total</TableCell>
							{playerNames.map((_, pIdx) => (
								<TableCell key={pIdx} colSpan={3} align="center" sx={{ fontWeight: 700 }}>
									{totalPoints(pIdx)}
								</TableCell>
							))}
						</TableRow>
					</TableBody>
				</Table>
			</Box>
		</Box>
	);

	return (
		<React.Fragment>
			<Container maxWidth="lg">
				<Paper sx={{ p: 3, borderRadius: 3, mt: 4, mb: 4 }}>
					<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
						<Typography variant="h4">🃏 Trumps — Live Game</Typography>
						<Stack direction="row" spacing={1} alignItems="center">
							<Chip size="small" label={connected ? 'Connected' : 'Disconnected'} color={connected ? 'success' : 'error'} />
							<Button variant="outlined" color="error" size="small" onClick={onLeaveGame}>Leave</Button>
						</Stack>
					</Stack>
					<Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)} sx={{ mb: 2 }}>
						<Tab label="Game" />
						<Tab label="History" />
					</Tabs>
					{error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
					{tabIndex === 0 && (
						!gameState.isGameStarted && !isCompleted ? renderWaitingRoom() : renderGame()
					)}
					{tabIndex === 1 && <ActualGameHistory />}
				</Paper>
			</Container>

			{/* End-of-game modal */}
			<Modal
				open={!endModalDismissed && (showEndModal || (isCompleted && !!finalResult && tabIndex === 0))}
				onClose={() => { setShowEndModal(false); setEndModalDismissed(true); }}
			>
				<Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'background.paper', p: 4, borderRadius: 3, boxShadow: 24, minWidth: 320 }}>
					<Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>🏆 Game Over</Typography>
					<Typography variant="h6" sx={{ mb: 2 }}>Final Scores</Typography>
					<Stack spacing={1} sx={{ mb: 2 }}>
						{(finalResult?.playerNames || playerNames).map((name, idx) => {
							const score = finalResult?.scores?.[idx] ?? totalPoints(idx);
							const isWinner = (finalResult?.winners || []).includes(name);
							return (
								<Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
									<Typography variant="body1" sx={{ fontWeight: 600 }}>
										{isWinner ? '🥇 ' : ''}{name}
									</Typography>
									<Chip label={score} color={isWinner ? 'success' : 'default'} />
								</Box>
							);
						})}
					</Stack>
					<Typography variant="h6" sx={{ mb: 2, color: '#43a047', fontWeight: 700 }}>
						Winner{(finalResult?.winners || []).length > 1 ? 's' : ''}: {(finalResult?.winners || []).join(', ')}
					</Typography>
					<Stack direction="row" spacing={2}>
						<Button variant="contained" onClick={onLeaveGame}>Back to Lobby</Button>
						<Button variant="outlined" onClick={() => { setShowEndModal(false); setEndModalDismissed(true); }}>View Score Sheet</Button>
					</Stack>
				</Box>
			</Modal>
		</React.Fragment>
	);
}
