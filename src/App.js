import React, { useState } from "react";
import {
  Container, Paper, Stack, Button, Typography,
  Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Box
} from "@mui/material";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Helper: cumulative μέχρι roundIdx
function cumulativePoints(pointsArr, roundIdx) {
  let sum = 0;
  for (let i = 0; i <= roundIdx; i++) {
    sum += pointsArr[i] || 0;
  }
  return sum;
}

// Για 2-5 παίκτες max=10, αλλιώς max = floor(52/n)
function generateRounds(n) {
  let max;
  if (n >= 2 && n <= 5) {
    max = 10;
  } else {
    max = Math.floor(52 / n);
  }
  let rounds = [];
  for (let i = max; i > 2; i--) rounds.push(i);
  for (let i = 0; i < n; i++) rounds.push(2);
  for (let i = 3; i <= max; i++) rounds.push(i);
  return rounds;
}

function getRankedSummary(players, numPlayers, totalPoints) {
  const summary = players.slice(0, numPlayers).map(p => ({
    Παίκτης: p.name,
    "Σύνολο Πόντων": totalPoints(p),
  })).sort((a, b) => b["Σύνολο Πόντων"] - a["Σύνολο Πόντων"]);
  let rank = 1;
  let prev = null;
  summary.forEach((row, i) => {
    row["Κατάταξη"] = row["Σύνολο Πόντων"] === prev ? rank : (rank = i + 1);
    prev = row["Σύνολο Πόντων"];
  });
  return summary;
}

const initialPlayers = Array(8).fill("").map((_, i) => ({
  name: `Παίκτης ${i + 1}`,
  predictions: [],
  tricks: [],
  points: [],
}));

export default function App() {
  const [players, setPlayers] = useState(initialPlayers);
  const [numPlayers, setNumPlayers] = useState(4);
  const [rounds, setRounds] = useState(generateRounds(4));
  const [gameDate, setGameDate] = useState("");

  const playerInputWidth = Math.max(100, Math.floor(900 / numPlayers));
  const cellWidth = Math.max(55, Math.floor(900 / (numPlayers * 2)));

  const handleNameChange = (idx, value) => {
    const newPlayers = [...players];
    newPlayers[idx].name = value;
    setPlayers(newPlayers);
  };

  const handlePrediction = (rIdx, pIdx, value) => {
    const newPlayers = [...players];
    newPlayers[pIdx].predictions[rIdx] = value === "" ? undefined : Number(value);
    setPlayers(newPlayers);
  };

  const handleTricks = (rIdx, pIdx, value) => {
    const newPlayers = [...players];
    newPlayers[pIdx].tricks[rIdx] = value === "" ? undefined : Number(value);
    const pred = newPlayers[pIdx].predictions[rIdx];
    const tricks = newPlayers[pIdx].tricks[rIdx];
    newPlayers[pIdx].points[rIdx] =
      pred !== undefined && tricks !== undefined && pred === tricks
        ? tricks + 10 // 10 πόντοι μπόνους
        : tricks || 0;
    setPlayers(newPlayers);
  };

  const totalPoints = (player) =>
    player.points.reduce((a, b) => a + (b || 0), 0);

  const resetGame = () => {
    const newPlayers = Array(8).fill("").map((_, i) => ({
      name: `Παίκτης ${i + 1}`,
      predictions: [],
      tricks: [],
      points: [],
    }));
    setPlayers(newPlayers);
    setNumPlayers(4);
    setRounds(generateRounds(4));
    setGameDate("");
  };

  const exportToPDF = async () => {
    const element = document.getElementById('dashboard-content');
    
    // Scroll to top to ensure we capture from the beginning
    window.scrollTo(0, 0);
    
    // Wait a moment for any layout changes
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const canvas = await html2canvas(element, {
      scale: 1.2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4'); // landscape orientation
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Calculate scaling to fit the content properly
    const widthRatio = pdfWidth / imgWidth;
    const heightRatio = pdfHeight / imgHeight;
    const ratio = Math.min(widthRatio, heightRatio);
    
    const scaledWidth = imgWidth * ratio;
    const scaledHeight = imgHeight * ratio;
    
    // Center the content
    const imgX = (pdfWidth - scaledWidth) / 2;
    const imgY = (pdfHeight - scaledHeight) / 2;
    
    // If content is too tall, we might need multiple pages
    if (scaledHeight > pdfHeight) {
      // For very tall content, use full width and multiple pages
      const pageHeight = pdfHeight;
      const contentRatio = pdfWidth / imgWidth;
      const contentHeight = imgHeight * contentRatio;
      
      let yPosition = 0;
      let pageNum = 0;
      
      while (yPosition < contentHeight) {
        if (pageNum > 0) {
          pdf.addPage();
        }
        
        const sourceY = yPosition / contentRatio;
        const sourceHeight = Math.min(pageHeight / contentRatio, imgHeight - sourceY);
        
        // Create a cropped canvas for this page
        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sourceHeight;
        
        pageCtx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
        const pageImgData = pageCanvas.toDataURL('image/png');
        
        pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, sourceHeight * contentRatio);
        
        yPosition += pageHeight;
        pageNum++;
      }
    } else {
      // Single page - content fits
      pdf.addImage(imgData, 'PNG', imgX, imgY, scaledWidth, scaledHeight);
    }
    
    const fileName = gameDate 
      ? `Trumps_${gameDate.replace("T", "_")}.pdf`
      : `Trumps_${new Date().toISOString().split('T')[0]}.pdf`;
    
    pdf.save(fileName);
  };

  return (
    <Container maxWidth="xl">
      <Paper id="dashboard-content" sx={{ p: 4, mt: 4 }}>
        <Stack spacing={3}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Typography variant="h4" align="left">
              Trumps – Dashboard
            </Typography>
            
            {/* Reference Guide */}
            <Paper 
              sx={{ 
                p: 2, 
                maxWidth: 300, 
                backgroundColor: "#f8f9fa",
                border: "1px solid #e0e0e0"
              }}
            >
              <Typography variant="h6" sx={{ mb: 1, color: "#1976d2", fontSize: "1rem" }}>
                📋 Οδηγός Χρήσης
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                  🎯 Βαθμολογία:
                </Typography>
                <Typography variant="caption" sx={{ display: "block", lineHeight: 1.3 }}>
                  • Σωστή πρόβλεψη: Μάζια + 10 πόντοι<br/>
                  • Λάθος πρόβλεψη: Μόνο τα μάζια
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                  🎨 Χρώματα Πίνακα:
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.3 }}>
                  <Box sx={{ width: 12, height: 12, backgroundColor: "#e7ffd6", border: "1px solid #43a047", mr: 1 }}></Box>
                  <Typography variant="caption">Σωστή πρόβλεψη</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.3 }}>
                  <Box sx={{ width: 12, height: 12, backgroundColor: "#e3f2fd", border: "1px solid #2196f3", mr: 1 }}></Box>
                  <Typography variant="caption">Ενεργός παίκτης</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.3 }}>
                  <Box sx={{ width: 12, height: 12, border: "2px solid #ff9800", mr: 1 }}></Box>
                  <Typography variant="caption">Τελευταίος παίκτης</Typography>
                </Box>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                  🔄 Σειρά Παικτών:
                </Typography>
                <Typography variant="caption" sx={{ display: "block", lineHeight: 1.3 }}>
                  Κάθε γύρος αρχίζει από διαφορετικό παίκτη.<br/>
                  Ο τελευταίος δεν μπορεί να κάνει το σύνολο ίσο με τα φύλλα.
                </Typography>
              </Box>
            </Paper>
          </Box>
          <Box>
            <TextField
              label="Ημερομηνία & ώρα παιχνιδιού"
              type="datetime-local"
              value={gameDate}
              onChange={e => setGameDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mr: 2 }}
            />
            <TextField
              label="Αριθμός παικτών"
              type="number"
              inputProps={{ min: 2, max: 8 }}
              value={numPlayers}
              onChange={e => {
                const n = Math.max(2, Math.min(8, Number(e.target.value)));
                setNumPlayers(n);
                setRounds(generateRounds(n));
              }}
              sx={{ width: 180 }}
            />
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {players.slice(0, numPlayers).map((p, i) => (
              <TextField
                key={i}
                value={p.name}
                onChange={e => handleNameChange(i, e.target.value)}
                label={`Παίκτης ${i + 1}`}
                sx={{ width: playerInputWidth }}
              />
            ))}
          </Stack>
          {/* Sticky Player Names Header */}
          <Box 
            sx={{ 
              position: "sticky", 
              top: 0, 
              backgroundColor: "#fff", 
              zIndex: 10,
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              borderBottom: "2px solid #1976d2",
              display: "table",
              width: "100%",
              tableLayout: "fixed"
            }}
          >
            <Box sx={{ display: "table-row" }}>
              <Box sx={{ 
                display: "table-cell",
                width: `${cellWidth}px`, 
                textAlign: "center", 
                fontWeight: "bold", 
                padding: "6px 16px", // MUI TableCell default padding
                borderRight: "1px solid #e0e0e0",
                verticalAlign: "middle"
              }}>
                Γύρος
              </Box>
              <Box sx={{ 
                display: "table-cell",
                width: `${cellWidth}px`, 
                textAlign: "center", 
                fontWeight: "bold", 
                padding: "6px 16px", // MUI TableCell default padding
                borderRight: "1px solid #e0e0e0",
                verticalAlign: "middle"
              }}>
                Φύλλα
              </Box>
              {players.slice(0, numPlayers).map((p, idx) => (
                <Box
                  key={idx}
                  sx={{ 
                    display: "table-cell",
                    width: `${cellWidth * 2}px`, // Two columns (Π + Μ)
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                    color: "#1976d2",
                    padding: "6px 16px", // MUI TableCell default padding
                    borderRight: idx < numPlayers - 1 ? "1px solid #e0e0e0" : "none",
                    verticalAlign: "middle"
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Box>{p.name}</Box>
                    <Typography variant="caption" sx={{ color: "#666", fontSize: "0.7rem" }}>
                      Παίκτης {idx + 1}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ overflowX: "auto" }} data-table-container>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ visibility: "hidden" }}>
                  <TableCell sx={{ fontWeight: "bold", width: cellWidth, padding: "6px 16px" }}>Γύρος</TableCell>
                  <TableCell sx={{ fontWeight: "bold", width: cellWidth, padding: "6px 16px" }}>Φύλλα</TableCell>
                  {players.slice(0, numPlayers).map((p, idx) => (
                    <TableCell 
                      key={idx} 
                      colSpan={2} 
                      align="center"
                      sx={{ 
                        fontWeight: "bold",
                        fontSize: "1.1rem",
                        color: "#1976d2",
                        width: cellWidth * 2,
                        padding: "6px 16px"
                      }}
                    >
                      {p.name}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rounds.map((cards, roundIdx) => {
                  // Rotating first player logic
                  const firstPlayerIdx = roundIdx % numPlayers; // Who starts this round
                  const lastPlayerIdx = (firstPlayerIdx - 1 + numPlayers) % numPlayers; // Who predicts last
                  
                  // Get predictions in the order they should be made
                  const predictionOrder = [];
                  for (let i = 0; i < numPlayers; i++) {
                    const playerIdx = (firstPlayerIdx + i) % numPlayers;
                    predictionOrder.push({
                      playerIdx,
                      prediction: players[playerIdx].predictions[roundIdx]
                    });
                  }
                  
                  // Calculate sum of predictions made so far in correct order
                  const sumPredSoFar = (targetPlayerIdx) => {
                    let sum = 0;
                    const targetOrderIdx = predictionOrder.findIndex(p => p.playerIdx === targetPlayerIdx);
                    for (let i = 0; i < targetOrderIdx; i++) {
                      const pred = predictionOrder[i].prediction;
                      sum += (pred !== undefined && pred !== null && pred !== "") ? Number(pred) : 0;
                    }
                    return sum;
                  };
                  
                  // Find first empty prediction in correct order
                  const firstEmptyInOrder = predictionOrder.find(p => 
                    p.prediction === undefined || p.prediction === null || p.prediction === ""
                  );
                  const activePlayerIdx = firstEmptyInOrder ? firstEmptyInOrder.playerIdx : -1;
                  
                  const sumAllPreds = predictionOrder.reduce((acc, p) => {
                    const val = p.prediction;
                    return acc + (val !== undefined && val !== null && val !== "" ? Number(val) : 0);
                  }, 0);
                  
                  return (
                    <React.Fragment key={roundIdx}>
                      <TableRow>
                        <TableCell rowSpan={2}>{roundIdx + 1}</TableCell>
                        <TableCell rowSpan={2}>
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            {cards}
                            <Typography
                              variant="caption"
                              sx={{ color: "#666", fontWeight: "normal" }}
                            >
                              Σύνολο προβλ: {sumAllPreds}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: "#1976d2", fontWeight: "bold", fontSize: "0.7rem" }}
                            >
                              Πρώτος: {players[firstPlayerIdx].name.split(' ')[1] || players[firstPlayerIdx].name}
                            </Typography>
                          </Box>
                        </TableCell>
                        {players.slice(0, numPlayers).map((p, playerIdx) => {
                          // Check if this player is the active one (next to predict)
                          const isActive = playerIdx === activePlayerIdx;
                          const isLastPlayer = playerIdx === lastPlayerIdx;
                          
                          let helper = "";
                          if (isActive && isLastPlayer && numPlayers > 1) {
                            // This is the last player to predict in this round
                            const forbidden = cards - sumPredSoFar(playerIdx);
                            helper = forbidden >= 0 && forbidden <= cards ? `ΟΧΙ ${forbidden}` : "ΟΣΕΣ";
                          }
                          
                          return (
                            <React.Fragment key={playerIdx}>
                              <TableCell sx={{ 
                                p: 0.5, 
                                width: cellWidth,
                                backgroundColor: isActive ? "#e3f2fd" : "inherit",
                                border: isLastPlayer ? "2px solid #ff9800" : "1px solid #e0e0e0"
                              }}>
                                <TextField
                                  label="Π"
                                  type="number"
                                  inputProps={{ min: 0, max: cards }}
                                  value={
                                    p.predictions[roundIdx] !== undefined
                                      ? p.predictions[roundIdx]
                                      : ""
                                  }
                                  onChange={e =>
                                    handlePrediction(roundIdx, playerIdx, e.target.value)
                                  }
                                  size="small"
                                  sx={{ width: "100%" }}
                                  helperText={helper}
                                  FormHelperTextProps={{
                                    sx: { color: helper ? "#d1381b !important" : "inherit", fontWeight: "bold" }
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ 
                                p: 0.5, 
                                width: cellWidth,
                                backgroundColor: isActive ? "#e3f2fd" : "inherit",
                                border: isLastPlayer ? "2px solid #ff9800" : "1px solid #e0e0e0"
                              }}>
                                <TextField
                                  label="Μ"
                                  type="number"
                                  inputProps={{ min: 0, max: cards }}
                                  value={
                                    p.tricks[roundIdx] !== undefined
                                      ? p.tricks[roundIdx]
                                      : ""
                                  }
                                  onChange={e =>
                                    handleTricks(roundIdx, playerIdx, e.target.value)
                                  }
                                  size="small"
                                  sx={{ width: "100%" }}
                                />
                              </TableCell>
                            </React.Fragment>
                          );
                        })}
                      </TableRow>
                      {/* Κυκλωμένος cumulative score */}
                      <TableRow>
                        {players.slice(0, numPlayers).map((p, idx) => {
                          const pred = p.predictions[roundIdx];
                          const tricks = p.tricks[roundIdx];
                          const hit =
                            pred === tricks &&
                            pred !== undefined &&
                            tricks !== undefined;
                          const cumPoints = cumulativePoints(p.points, roundIdx);
                          return (
                            <TableCell
                              key={`points-${roundIdx}-${idx}`}
                              colSpan={2}
                              align="center"
                              sx={{
                                backgroundColor: hit ? "#e7ffd6" : "#f8f8f8",
                                fontWeight: "bold",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "inline-block",
                                  border: hit ? "2px solid #43a047" : undefined,
                                  borderRadius: hit ? "50%" : undefined,
                                  px: 2,
                                  py: 0.5,
                                  fontWeight: "bold",
                                  color: hit ? "#1b3c20" : "inherit",
                                  fontSize: "1.07em",
                                  letterSpacing: "1px",
                                  minWidth: 55,
                                }}
                              >
                                {cumPoints} πόντοι
                              </Box>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          {/* Κατάταξη */}
          <Box>
            <Typography variant="h6" mt={2} mb={2} sx={{ fontWeight: "bold", color: "#1976d2" }}>
              🏆 Κατάταξη
            </Typography>
            <Table size="small" sx={{ maxWidth: 500, border: "1px solid #e0e0e0", borderRadius: 2 }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>Κατάταξη</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Παίκτης</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Πόντοι</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getRankedSummary(players, numPlayers, totalPoints).map(
                  (row, i) => (
                    <TableRow 
                      key={i}
                      sx={{ 
                        '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' },
                        '&:first-of-type': { backgroundColor: '#fff3e0', fontWeight: 'bold' } // Highlight winner
                      }}
                    >
                      <TableCell>
                        {row["Κατάταξη"] === 1 ? "🥇" : row["Κατάταξη"] === 2 ? "🥈" : row["Κατάταξη"] === 3 ? "🥉" : row["Κατάταξη"]}
                      </TableCell>
                      <TableCell sx={{ fontWeight: row["Κατάταξη"] === 1 ? "bold" : "normal" }}>
                        {row["Παίκτης"]}
                      </TableCell>
                      <TableCell sx={{ fontWeight: row["Κατάταξη"] === 1 ? "bold" : "normal" }}>
                        {row["Σύνολο Πόντων"]}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" color="success" onClick={exportToPDF}>
              Εξαγωγή σε PDF
            </Button>
            <Button variant="outlined" color="error" onClick={resetGame}>
              Νέο Παιχνίδι
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}
