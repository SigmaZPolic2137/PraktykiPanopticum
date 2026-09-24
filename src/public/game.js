// Symulacja jednej rozgrywki. Działa w przeglądarce hosta, który jest jedynym źródłem prawdy o stanie gry;
// telefony wysyłają przez serwer tylko informację, czy gracz trzyma przycisk.

// Wysokość świata jest stała (skalujemy ją do wysokości okna), szerokość zależy od proporcji ekranu hosta,
// więc sufit i ziemia zawsze pokrywają się z krawędziami ekranu.
export const World = {
    Height: 900,
    GroundY: 800,
    CeilingY: 0,
};

export const PlayerSize = 44;
const PlayerHitRadius = 17;

// Gracz rozpędza się do przodu, ale najdalej do 3/4 szerokości ekranu.
const TargetFraction = 0.75;
const StartFraction = 0.3;
const ForwardAccel = 90;
const MaxForwardSpeed = 180;

const VerticalAccel = 4200;

// Spacing: odstęp między układami kolców, na pełnej trudności mnożony przez (1 - SpacingRamp).
// RampTime: po ilu sekundach gra osiąga pełną trudność. Patterns: wagi losowania układów kolców.
export const Difficulties = {
    easy: {
        Label: "Łatwy",
        StartSpeed: 330, SpeedGain: 4, MaxSpeed: 700, RampTime: 120,
        Spacing: [700, 1100], SpacingRamp: 0.3,
        MaxGroup: 2, HeightScale: 0.8,
        Gap: [380, 440], GapShrink: 40,
        SlowDuration: 1.3, SlowDriftSpeed: 170,
        Patterns: { Ground: 0.35, Ceiling: 0.35, Big: 0.1, Gap: 0.2, Tunnel: 0 },
    },
    medium: {
        Label: "Średni",
        StartSpeed: 400, SpeedGain: 7, MaxSpeed: 950, RampTime: 90,
        Spacing: [480, 860], SpacingRamp: 0.4,
        MaxGroup: 3, HeightScale: 1,
        Gap: [300, 360], GapShrink: 70,
        SlowDuration: 1.8, SlowDriftSpeed: 220,
        Patterns: { Ground: 0.3, Ceiling: 0.25, Big: 0.2, Gap: 0.25, Tunnel: 0 },
    },
    hard: {
        Label: "Trudny",
        StartSpeed: 500, SpeedGain: 12, MaxSpeed: 1200, RampTime: 60,
        Spacing: [180, 360], SpacingRamp: 0.35,
        MaxGroup: 5, HeightScale: 1.12,
        Gap: [230, 270], GapShrink: 40,
        SlowDuration: 2.2, SlowDriftSpeed: 260,
        Patterns: { Ground: 0.2, Ceiling: 0.2, Big: 0.2, Gap: 0.2, Tunnel: 0.2 },
    },
};

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
    constructor(PlayerList, Width, DifficultyName = "medium") {
        this.Settings = Difficulties[DifficultyName] || Difficulties.medium;
        this.Width = Width;
        this.Time = 0;
        this.Countdown = CountdownSeconds;
        this.Distance = 0;
        this.Speed = this.Settings.StartSpeed;
        this.Spikes = [];
        this.NextSpikeID = 1;
        this.NextSpawnX = Width + 200;
        this.Players = new Map();
        this.Over = false;

        const Spacing = (World.GroundY - 240) / Math.max(PlayerList.length, 1);

        PlayerList.forEach(({ ID, PlayerName }, Index) => {
            this.Players.set(ID, {
                ID,
                PlayerName,
                Color: Colors[Index % Colors.length],
                X: Width * StartFraction,
                Y: 120 + Spacing * (Index + 0.5),
                VX: 0,
                VY: 0,
                Holding: false,
                SlowTimer: 0,
                Alive: true,
                Score: 0,
                Place: null,
            });
        });
    }

    get TargetX() {
        return this.Width * TargetFraction;
    }

    // Wywoływane przy zmianie rozmiaru okna hosta.
    SetWidth(Width) {
        this.Width = Width;
        for (const Player of this.Players.values()) Player.X = Math.min(Player.X, this.TargetX);
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

        if (this.Countdown > 0) {
            this.Countdown -= Dt;
            if (this.Countdown <= 0) {
                this.Countdown = 0;
                Events.push({ Type: "go" });
            }
            return Events;
        }

        this.Time += Dt;
        const { StartSpeed, SpeedGain, MaxSpeed } = this.Settings;
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
                Player.VX = -this.Settings.SlowDriftSpeed;
            } else {
                // Po spowolnieniu gracz od razu zaczyna znowu przyspieszać, bez wytracania cofania.
                Player.VX = Math.min(MaxForwardSpeed, Math.max(0, Player.VX) + ForwardAccel * Dt);
            }

            Player.X += Player.VX * Dt;
            if (Player.X >= this.TargetX) {
                Player.X = this.TargetX;
                Player.VX = 0;
            }

            if (Player.SlowTimer <= 0 && this.HitsSpike(Player)) {
                Player.SlowTimer = this.Settings.SlowDuration;
                Events.push({ Type: "hit", ID: Player.ID });
            }

            Player.Score = Math.max(0, Math.floor((this.Distance + Player.X) / 100));

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
        this.Spikes.push({ ID: this.NextSpikeID++, X, Y, W, H, Dir });
    }

    // Od 0 na starcie do 1 po RampTime sekundach.
    get Difficulty() {
        return Math.min(1, this.Time / this.Settings.RampTime);
    }

    SpawnSpikes() {
        const { Spacing, SpacingRamp } = this.Settings;

        while (this.NextSpawnX < this.Distance + this.Width + 200) {
            const Width = this.SpawnPattern(this.NextSpawnX);
            const Scale = 1 - SpacingRamp * this.Difficulty;

            this.NextSpawnX += Width + Rand(Spacing[0], Spacing[1]) * Scale;
        }
    }

    PickPattern() {
        const Patterns = Object.entries(this.Settings.Patterns);
        let Roll = Math.random() * Patterns.reduce((Sum, [, Weight]) => Sum + Weight, 0);

        for (const [Name, Weight] of Patterns) {
            Roll -= Weight;
            if (Roll < 0) return Name;
        }

        return Patterns[0][0];
    }

    AddGapColumn(X, W, GapCenter, Gap) {
        this.AddSpike(X, World.CeilingY, W, GapCenter - Gap / 2 - World.CeilingY, "down");
        this.AddSpike(X, World.GroundY, W, World.GroundY - GapCenter - Gap / 2, "up");
    }

    RandomGap() {
        const { Gap, GapShrink } = this.Settings;
        return Rand(Gap[0], Gap[1]) - GapShrink * this.Difficulty;
    }

    // Zwraca szerokość wstawionego układu kolców. Każdy kolec wyrasta z ziemi albo zwisa z sufitu.
    SpawnPattern(X) {
        const { MaxGroup, HeightScale } = this.Settings;
        const PlayHeight = World.GroundY - World.CeilingY;
        const Pattern = this.PickPattern();

        if (Pattern === "Ground" || Pattern === "Ceiling") {
            const Count = RandInt(1, MaxGroup);
            const W = Rand(95, 130);
            const H = Rand(170, 330) * HeightScale;
            for (let I = 0; I < Count; I++) {
                if (Pattern === "Ground") this.AddSpike(X + I * W, World.GroundY, W, H, "up");
                else this.AddSpike(X + I * W, World.CeilingY, W, H, "down");
            }
            return Count * W;
        }

        if (Pattern === "Big") {
            // Jeden duży kolec zasłaniający ponad połowę wysokości.
            const W = Rand(140, 180);
            const H = Rand(0.5, 0.62) * PlayHeight * HeightScale;
            if (Math.random() < 0.5) this.AddSpike(X, World.GroundY, W, H, "up");
            else this.AddSpike(X, World.CeilingY, W, H, "down");
            return W;
        }

        const Gap = this.RandomGap();
        const MinCenter = World.CeilingY + 130 + Gap / 2;
        const MaxCenter = World.GroundY - 130 - Gap / 2;

        if (Pattern === "Tunnel") {
            // Długi korytarz z kolców, którego szczelina wije się w górę i w dół.
            const Count = RandInt(4, 8);
            const W = Rand(85, 105);
            let Center = Rand(MinCenter, MaxCenter);
            for (let I = 0; I < Count; I++) {
                this.AddGapColumn(X + I * W, W, Center, Gap);
                Center = Math.max(MinCenter, Math.min(MaxCenter, Center + Rand(-70, 70)));
            }
            return Count * W;
        }

        // Kolce z góry i z dołu, między nimi szczelina do przelotu.
        const W = Rand(110, 150);
        this.AddGapColumn(X, W, Rand(MinCenter, MaxCenter), Gap);
        return W;
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
