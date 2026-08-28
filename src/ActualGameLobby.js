
import React from 'react';
import { Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function ActualGameLobby() {
	const navigate = useNavigate();
	return (
		<Box sx={{ p: 3 }}>
			{/* ...existing lobby UI... */}
			<Button
				variant="contained"
				color="primary"
				sx={{ mt: 2, borderRadius: 2 }}
				onClick={() => navigate('/actual-history')}
			>
				View Advanced Game History
			</Button>
		</Box>
	);
}
