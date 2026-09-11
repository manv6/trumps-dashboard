import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from '../components/Header';
import { Card, PageBg } from '../components/UI';
import { night, displayFont } from '../theme';

function Section({ title, children }) {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function P({ children, style }) {
  return <Text style={[styles.p, style]}>{children}</Text>;
}

function Bullet({ children }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>♠</Text>
      <Text style={[styles.p, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

export default function HelpScreen({ navigation }) {
  return (
    <View style={styles.page}>
      <Header subtitle="Βοήθεια" onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
        <PageBg />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Πώς παίζεται το Trumps</Text>

          <Section title="Ο στόχος">
            <P>
              Σε κάθε γύρο προβλέπεις πόσες «νίκες» (μάζες) θα πάρεις — και μετά προσπαθείς
              να πετύχεις ΑΚΡΙΒΩΣ την πρόβλεψή σου. Ούτε παραπάνω, ούτε λιγότερες.
            </P>
          </Section>

          <Section title="Η αρχή — ποιος μοιράζει">
            <P>
              Πριν τον πρώτο γύρο, μοιράζονται φύλλα ένα-ένα σε κάθε παίκτη μέχρι να εμφανιστεί
              ο πρώτος άσσος. Όποιος τον πάρει, μοιράζει — και ο παίκτης στα αριστερά του
              παίζει πρώτος. Σε κάθε επόμενο γύρο ο «πρώτος» μετακινείται μία θέση.
            </P>
          </Section>

          <Section title="Η πρόβλεψη">
            <Bullet>Οι παίκτες προβλέπουν με τη σειρά, ξεκινώντας από τον πρώτο.</Bullet>
            <Bullet>
              Ο τελευταίος έχει έναν περιορισμό: το σύνολο των προβλέψεων ΔΕΝ επιτρέπεται να
              βγει ίσο με τα φύλλα του γύρου. Κάποιος θα βγει λάθος — εκεί είναι το παιχνίδι.
            </Bullet>
          </Section>

          <Section title="Το παίξιμο">
            <Bullet>Ο πρώτος ρίχνει όποιο φύλλο θέλει — αυτό ορίζει το «χρώμα» της μπάζας.</Bullet>
            <Bullet>Οι υπόλοιποι ΠΡΕΠΕΙ να ακολουθήσουν το χρώμα αν έχουν.</Bullet>
            <Bullet>
              Τα μπαστούνια ♠ είναι πάντα ατού (μπαλαντέρ): αν δεν έχεις το χρώμα, μπορείς να
              «κόψεις» με μπαστούνι. Το μεγαλύτερο μπαστούνι κερδίζει τη μάζα — αλλιώς το
              μεγαλύτερο φύλλο του χρώματος.
            </Bullet>
            <Bullet>Όποιος πάρει τη μάζα, παίζει πρώτος στην επόμενη.</Bullet>
          </Section>

          <Section title="Η βαθμολογία">
            <Bullet>Πέτυχες την πρόβλεψη: νίκες + 10 πόντοι μπόνους.</Bullet>
            <Bullet>Αστόχησες: παίρνεις μόνο όσες νίκες έκανες, χωρίς μπόνους.</Bullet>
            <P style={styles.example}>
              Παράδειγμα: πρόβλεψη 3, νίκες 3 → 13 πόντοι. Πρόβλεψη 3, νίκες 4 → μόνο 4.
            </P>
          </Section>

          <Section title="Οι γύροι">
            <P>
              Τα φύλλα ανά γύρο κατεβαίνουν από το μέγιστο (10 για 2–5 παίκτες) μέχρι το 2,
              μένουν στο 2 για τόσους γύρους όσοι και οι παίκτες, και ανεβαίνουν ξανά.
              Νικητής όποιος μαζέψει τους περισσότερους πόντους συνολικά.
            </P>
          </Section>

          <Section title="Οι δύο τρόποι παιχνιδιού">
            <Bullet>
              ♠ Live Κάρτες: οι κάρτες μοιράζονται και παίζονται εδώ, στο κινητό — με πραγματικό
              χρόνο, σειρά και κανόνες που τηρούνται αυτόματα.
            </Bullet>
            <Bullet>
              Μόνο Σκορ: παίζετε με αληθινή τράπουλα στο τραπέζι και η εφαρμογή κρατάει το
              φύλλο σκορ. Ο host γράφει προβλέψεις και νίκες για όλους — και μπορεί να αλλάξει
              τη σειρά των θέσεων.
            </Bullet>
          </Section>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: night.bgBottom },
  scroll: { padding: 16, paddingBottom: 46 },
  title: { fontFamily: displayFont, fontSize: 24, color: night.text, marginBottom: 14 },
  section: { marginBottom: 12 },
  sectionTitle: { fontFamily: displayFont, fontSize: 17, color: night.gold, marginBottom: 8 },
  p: { color: night.text, fontSize: 14, lineHeight: 21 },
  example: { color: night.muted, marginTop: 8, fontSize: 13 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  bulletDot: { color: night.gold, fontSize: 12, marginTop: 3 },
});
