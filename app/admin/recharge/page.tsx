'use client';

import { useCallback, useEffect, useState } from 'react';
import RoleProtectedRoute from '../../components/RoleProtectedRoute';
import { notifyCreditsUpdated } from '../../components/CreditCounter';
import { api } from '@/lib/api';
import { creditsConfig } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Coins, PackagePlus, SlidersHorizontal } from 'lucide-react';

function RechargePageContent() {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number | null>(null);

  // Formulaire recharge
  const [packLabel, setPackLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [note, setNote] = useState('');
  const [submittingRecharge, setSubmittingRecharge] = useState(false);

  // Formulaire ajustement
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await api.request(api.endpoints.creditsBalance);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.balance === 'number') setBalance(data.balance);
      }
    } catch {
      // non bloquant
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const selectPack = (label: string, credits: number) => {
    setPackLabel(label);
    setAmount(String(credits));
  };

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) {
      toast({
        title: 'Montant invalide',
        description: 'Indiquez un nombre entier de crédits strictement positif.',
        variant: 'destructive',
      });
      return;
    }
    setSubmittingRecharge(true);
    try {
      const res = await api.request(api.endpoints.creditsRecharge, {
        method: 'POST',
        body: JSON.stringify({
          amount: n,
          packLabel: packLabel.trim() || null,
          paymentRef: paymentRef.trim() || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      toast({
        title: 'Recharge effectuée',
        description: `+${n} crédits ajoutés. Nouveau solde : ${data.balance}.`,
      });
      setBalance(typeof data.balance === 'number' ? data.balance : null);
      setPackLabel('');
      setAmount('');
      setPaymentRef('');
      setNote('');
      notifyCreditsUpdated();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de la recharge',
        variant: 'destructive',
      });
    } finally {
      setSubmittingRecharge(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(adjustAmount);
    if (!Number.isInteger(n) || n === 0) {
      toast({
        title: 'Montant invalide',
        description: 'Indiquez un nombre entier non nul (positif ou négatif).',
        variant: 'destructive',
      });
      return;
    }
    if (!adjustNote.trim()) {
      toast({
        title: 'Note obligatoire',
        description: "Expliquez la raison de l'ajustement dans la note.",
        variant: 'destructive',
      });
      return;
    }
    setSubmittingAdjust(true);
    try {
      const res = await api.request(api.endpoints.creditsAjustement, {
        method: 'POST',
        body: JSON.stringify({ amount: n, note: adjustNote.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      toast({
        title: 'Ajustement enregistré',
        description: `${n > 0 ? '+' : ''}${n} crédit(s). Nouveau solde : ${data.balance}.`,
      });
      setBalance(typeof data.balance === 'number' ? data.balance : null);
      setAdjustAmount('');
      setAdjustNote('');
      notifyCreditsUpdated();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : "Erreur lors de l'ajustement",
        variant: 'destructive',
      });
    } finally {
      setSubmittingAdjust(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Rappel du solde actuel */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-800 flex items-center justify-center">
                <Coins className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Solde actuel de l&apos;agence</p>
                <p className="text-4xl font-bold text-gray-900">
                  {balance !== null ? `${balance} crédits` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recharge (achat de pack) */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-emerald-600" />
              Recharger le compte
            </CardTitle>
            <CardDescription>
              À utiliser après réception d&apos;un paiement hors ligne (virement, espèces…). La
              recharge crée une ligne ACHAT_PACK dans l&apos;historique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecharge} className="space-y-4">
              <div>
                <Label className="mb-2 block">Packs rapides</Label>
                <div className="flex flex-wrap gap-2">
                  {creditsConfig.packs.map((pack) => (
                    <Button
                      key={pack.label}
                      type="button"
                      variant={packLabel === pack.label ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => selectPack(pack.label, pack.credits)}
                    >
                      {pack.label} ({pack.credits} crédits —{' '}
                      {(pack.credits * creditsConfig.prixCreditDh).toLocaleString('fr-FR')} DH)
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recharge-amount">Nombre de crédits *</Label>
                  <Input
                    id="recharge-amount"
                    type="number"
                    min={1}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Ex : 150"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="recharge-pack">Libellé du pack</Label>
                  <Input
                    id="recharge-pack"
                    value={packLabel}
                    onChange={(e) => setPackLabel(e.target.value)}
                    placeholder="Ex : Pack 150 (ou montant libre)"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recharge-ref">Référence du paiement</Label>
                  <Input
                    id="recharge-ref"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Ex : Virement N° 12345 / Espèces"
                  />
                </div>
                <div>
                  <Label htmlFor="recharge-note">Note (optionnel)</Label>
                  <Input
                    id="recharge-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Commentaire libre"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={submittingRecharge}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submittingRecharge ? 'Enregistrement…' : 'Créditer le compte'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Ajustement manuel */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-purple-600" />
              Ajustement manuel
            </CardTitle>
            <CardDescription>
              Correction exceptionnelle du solde (positive ou négative). La note est obligatoire ;
              un ajustement négatif ne peut pas rendre le solde négatif.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adjust-amount">Montant (± crédits) *</Label>
                  <Input
                    id="adjust-amount"
                    type="number"
                    step={1}
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="Ex : -3 ou 10"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="adjust-note">Note (obligatoire) *</Label>
                  <Input
                    id="adjust-note"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="Raison de l'ajustement"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={submittingAdjust}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {submittingAdjust ? 'Enregistrement…' : "Appliquer l'ajustement"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminRechargePage() {
  return (
    <RoleProtectedRoute allowedRoles={['SUPER_ADMIN']}>
      <RechargePageContent />
    </RoleProtectedRoute>
  );
}
