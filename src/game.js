// Symulacja jednej rozgrywki. Serwer jest jedynym źródłem prawdy o stanie gry,
// telefony wysyłają tylko informację, czy gracz trzyma przycisk.

export const World = {
    Width: 1600,
    Height: 900,
    GroundY: 800,
    CeilingY: 0,
};

const PlayerSize = 44;
const PlayerHitRadius = 17;
const TargetX = 700;

const StartSpeed = 420;
const SpeedGain = 7;
const MaxSpeed = 950;
const VerticalAccel = 4200;

const SlowDuration = 1.8;
const SlowDriftSpeed = 170;
const RecoverSpeed = 50;

const CountdownSeconds = 3;

const Colors = [
    "#ff4757", "#1e90ff", "#ffa502", "#2ed573",
    "#a55eea", "#ff6b81", "#00d2d3", "#eccc68",
    "#ff7f50", "#7bed9f", "#70a1ff", "#5352ed",
    "#ff6348", "#badc58", "#f8a5c2", "#c8d6e5",
];

// (:) //

function Rand(Min, Max) {
    return Min + Math.random() * (Max - Min);
}

function RandInt(Min, Max) {
    return Math.floor(Rand(Min, Max + 1));
}

function Approach(Value, Target, Step) {
    if (Value < Target) return Math.min(Target, Value + Step);
    return Math.max(Target, Value - Step);
}

function Round(Value) {
    return Math.round(Value * 10) / 10;
}

function SegmentDistanceSquared(PX, PY, AX, AY, BX, BY) {
    const DX = BX - AX;
    const DY = BY - AY;
    const T = Math.max(0, Math.min(1, ((PX - AX) * DX + (PY - AY) * DY) / (DX * DX + DY * DY)));
    const CX = AX + T * DX - PX;
    const CY = AY + T * DY - PY;

    return CX * CX + CY * CY;
}

function PointInTriangle(PX, PY, [A, B, C]) {
    const Side = (P1, P2) => (PX - P2[0]) * (P1[1] - P2[1]) - (P1[0] - P2[0]) * (PY - P2[1]);
    const D1 = Side(A, B);
    const D2 = Side(B, C);
    const D3 = Side(C, A);
    const HasNegative = D1 < 0 || D2 < 0 || D3 < 0;
    const HasPositive = D1 > 0 || D2 > 0 || D3 > 0;

    return !(HasNegative && HasPositive);
}

function CircleHitsTriangle(CX, CY, R, Triangle) {
    if (PointInTriangle(CX, CY, Triangle)) return true;

    const RR = R * R;
    for (let I = 0; I < 3; I++) {
        const [AX, AY] = Triangle[I];
        const [BX, BY] = Triangle[(I + 1) % 3];
        if (SegmentDistanceSquared(CX, CY, AX, AY, BX, BY) < RR) return true;
    }

    return false;
}

// D:D //

export class Game {
    constructor(PlayerList) {
        this.Clock = 0;
        this.Time = 0;
        this.Countdown = CountdownSeconds;
        this.Distance = 0;
        this.Speed = StartSpeed;
        this.Spikes = [];
        this.NextSpikeID = 1;
        this.NextSpawnX = World.Width + 200;
        this.Players = new Map();
        this.Over = false;

        const Spacing = (World.GroundY - 240) / Math.max(PlayerList.length, 1);

        PlayerList.forEach(({ ID, PlayerName }, Index) => {
            this.Players.set(ID, {
                ID,
                PlayerName,
                Color: Colors[Index % Colors.length],
                X: TargetX,
                Y: 120 + Spacing * (Index + 0.5),
                VY: 0,
                Holding: false,
                SlowTimer: 0,
                Alive: true,
                Score: 0,
                Place: null,
            });
        });
    }

    get AliveCount() {
        let Count = 0;
        for (const Player of this.Players.values()) if (Player.Alive) Count++;
        return Count;
    }

    SetHolding(ID, Holding) {
        const Player = this.Players.get(ID);
        if (Player) Player.Holding = Holding;
    }

    RemovePlayer(ID) {
        this.Players.delete(ID);
        if (this.AliveCount === 0) this.Over = true;
    }

    // Zwraca listę zdarzeń: { Type: "go" | "hit" | "eliminated", ... }
    Update(Dt) {
        const Events = [];
        if (this.Over) return Events;

        this.Clock += Dt;

        if (this.Countdown > 0) {
            this.Countdown -= Dt;
            if (this.Countdown <= 0) {
                this.Countdown = 0;
                Events.push({ Type: "go" });
            }
            return Events;
        }

        this.Time += Dt;
        this.Speed = Math.min(MaxSpeed, StartSpeed + SpeedGain * this.Time);
        this.Distance += this.Speed * Dt;

        this.SpawnSpikes();
        this.Spikes = this.Spikes.filter(Spike => Spike.X + Spike.W > this.Distance - 200);

        const Half = PlayerSize / 2;
        const MaxVY = this.Speed * 0.95;

        for (const Player of this.Players.values()) {
            if (!Player.Alive) continue;

            Player.VY = Approach(Player.VY, Player.Holding ? -MaxVY : MaxVY, VerticalAccel * Dt);
            Player.Y += Player.VY * Dt;

            if (Player.Y < World.CeilingY + Half) {
                Player.Y = World.CeilingY + Half;
                Player.VY = 0;
            }
            if (Player.Y > World.GroundY - Half) {
                Player.Y = World.GroundY - Half;
                Player.VY = 0;
            }

            if (Player.SlowTimer > 0) {
                Player.SlowTimer -= Dt;
                Player.X -= SlowDriftSpeed * Dt;
            } else if (Player.X < TargetX) {
                Player.X = Math.min(TargetX, Player.X + RecoverSpeed * Dt);
            }

            if (Player.SlowTimer <= 0 && this.HitsSpike(Player)) {
                Player.SlowTimer = SlowDuration;
                Events.push({ Type: "hit", ID: Player.ID });
            }

            Player.Score = Math.max(0, Math.floor((this.Distance + Player.X - TargetX) / 100));

            if (Player.X + Half < 0) {
                Player.Alive = false;
                Player.Place = this.AliveCount + 1;
                Events.push({ Type: "eliminated", ID: Player.ID, Score: Player.Score, Place: Player.Place });
            }
        }

        if (this.AliveCount === 0) this.Over = true;

        return Events;
    }

    HitsSpike(Player) {
        for (const Spike of this.Spikes) {
            const Left = Spike.X - this.Distance;
            if (Left > Player.X + PlayerHitRadius || Left + Spike.W < Player.X - PlayerHitRadius) continue;

            const TipY = Spike.Dir === "up" ? Spike.Y - Spike.H : Spike.Y + Spike.H;
            const Triangle = [[Left, Spike.Y], [Left + Spike.W, Spike.Y], [Left + Spike.W / 2, TipY]];

            if (CircleHitsTriangle(Player.X, Player.Y, PlayerHitRadius, Triangle)) return true;
        }

        return false;
    }

    AddSpike(X, Y, W, H, Dir) {
        this.Spikes.push({ ID: this.NextSpikeID++, X: Round(X), Y: Round(Y), W: Round(W), H: Round(H), Dir });
    }

    SpawnSpikes() {
        while (this.NextSpawnX < this.Distance + World.Width + 200) {
            const Width = this.SpawnPattern(this.NextSpawnX);
            const Difficulty = Math.min(1, this.Time / 90);

            this.NextSpawnX += Width + Rand(480 - 200 * Difficulty, 860 - 340 * Difficulty);
        }
    }

    // Zwraca szerokość wstawionego układu kolców.
    SpawnPattern(X) {
        const Roll = Math.random();
        const W = Rand(60, 85);

        if (Roll < 0.3) {
            const Count = RandInt(1, 3);
            const H = Rand(80, 150);
            for (let I = 0; I < Count; I++) this.AddSpike(X + I * W, World.GroundY, W, H, "up");
            return Count * W;
        }

        if (Roll < 0.55) {
            const Count = RandInt(1, 3);
            const H = Rand(100, 220);
            for (let I = 0; I < Count; I++) this.AddSpike(X + I * W, World.CeilingY, W, H, "down");
            return Count * W;
        }

        if (Roll < 0.8) {
            const Y = Rand(200, World.GroundY - 200);
            const H = Rand(45, 70);
            this.AddSpike(X, Y, W, H, "up");
            this.AddSpike(X, Y, W, H, "down");
            return W;
        }

        const TopH = Rand(80, 260);
        const BottomH = Rand(80, Math.max(80, 520 - TopH));
        this.AddSpike(X, World.CeilingY, W, TopH, "down");
        this.AddSpike(X, World.GroundY, W, BottomH, "up");
        return W;
    }

    Snapshot() {
        return {
            T: Math.round(this.Clock * 1000) / 1000,
            Countdown: Math.ceil(this.Countdown),
            Distance: Round(this.Distance),
            Speed: Round(this.Speed),
            Players: [...this.Players.values()].map(Player => ({
                ID: Player.ID,
                PlayerName: Player.PlayerName,
                Color: Player.Color,
                X: Round(Player.X),
                Y: Round(Player.Y),
                VY: Round(Player.VY),
                Alive: Player.Alive,
                Slowed: Player.SlowTimer > 0,
                Score: Player.Score,
            })),
            Spikes: this.Spikes,
        };
    }

    Results() {
        return [...this.Players.values()]
            .sort((A, B) => B.Score - A.Score)
            .map((Player, Index) => ({
                ID: Player.ID,
                PlayerName: Player.PlayerName,
                Color: Player.Color,
                Score: Player.Score,
                Place: Index + 1,
            }));
    }
}