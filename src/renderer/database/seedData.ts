import { db, Lesson, MoveNode, Chapter } from './db';
import { Chess } from 'chess.js';

export interface SimpleMove {
  san: string;
  comment?: string;
  arrows?: Array<{ from: string; to: string; color: string }>;
  circles?: Array<{ square: string; color: string }>;
  children?: SimpleMove[];
}

function compileSimpleMoves(simple: SimpleMove[], startFen: string): MoveNode[] {
  return simple.map(s => {
    const game = new Chess(startFen);
    try {
      const move = game.move(s.san);
      const nextFen = game.fen();
      const node: MoveNode = {
        id: Math.random().toString(36).substring(2, 9),
        notation: move.san,
        from: move.from,
        to: move.to,
        fen: nextFen,
        comment: s.comment,
        arrows: s.arrows,
        circles: s.circles,
        children: s.children ? compileSimpleMoves(s.children, nextFen) : []
      };
      return node;
    } catch (err) {
      console.error(`Invalid seed move ${s.san} at FEN ${startFen}:`, err);
      return {
        id: Math.random().toString(36).substring(2, 9),
        notation: s.san,
        from: '',
        to: '',
        fen: startFen,
        comment: `${s.comment || ''} (Error: Invalid move)`,
        children: []
      };
    }
  });
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const seedLessons: Omit<Lesson, 'id'>[] = [
  {
    name: 'The Sicilian Najdorf: English Attack vs Classical Bg5',
    category: 'Openings',
    difficulty: 'Intermediate',
    description: 'Learn the primary responses in the sharp Sicilian Najdorf. This opening is a favorite of Bobby Fischer and Garry Kasparov, offering unbalanced, double-edged middlegames.',
    isFavorite: 1,
    tags: ['Opening', 'Najdorf', 'Tactical', 'Counterattack'],
    createdAt: Date.now(),
    chapters: [
      {
        id: 'najdorf-english',
        name: 'The English Attack (6. Be3)',
        fen: START_FEN,
        moves: compileSimpleMoves([
          {
            san: 'e4',
            comment: 'White controls the center.',
            children: [{
              san: 'c5',
              comment: 'The Sicilian Defense. Black fights for the d4 square asynchronously.',
              children: [{
                san: 'Nf3',
                comment: 'Developing the knight.',
                children: [{
                  san: 'd6',
                  comment: 'Opening path for the light-squared bishop.',
                  children: [{
                    san: 'd4',
                    comment: 'Opening the center.',
                    children: [{
                      san: 'cxd4',
                      comment: 'Black exchanges wing pawn for center pawn.',
                      children: [{
                        san: 'Nxd4',
                        comment: 'White recaputes.',
                        children: [{
                          san: 'Nf6',
                          comment: 'Attacking the e4 pawn.',
                          children: [{
                            san: 'Nc3',
                            comment: 'Defending e4.',
                            children: [{
                              san: 'a6',
                              comment: 'The Najdorf signature move! Prevents Bb5+ and Nb5, preparing b7-b5.',
                              children: [
                                {
                                  san: 'Be3',
                                  comment: 'The English Attack. White plans Qd2, f3, and g4-g5 kingside storm.',
                                  arrows: [{ from: 'e3', to: 'd2', color: 'green' }, { from: 'f2', to: 'f3', color: 'green' }],
                                  children: [{
                                    san: 'e5',
                                    comment: 'Striking back in the center, forcing the Knight to move.',
                                    children: [{
                                      san: 'Nb3',
                                      comment: 'Retreating to a safe spot.',
                                      children: [{
                                        san: 'Be6',
                                        comment: 'Developing the bishop, defending the center and preparing d6-d5.',
                                        children: [{
                                          san: 'f3',
                                          comment: 'White defends e4 and prepares the g4-g5 storm. Extremely sharp game ahead.',
                                          circles: [{ square: 'g4', color: 'red' }]
                                        }]
                                      }]
                                    }]
                                  }]
                                },
                                {
                                  san: 'Bg5',
                                  comment: 'The Classical Main Line. Pinning the knight on f6.',
                                  children: [{
                                    san: 'e6',
                                    comment: 'Blunting the pin and preparing Be7.',
                                    children: [{
                                      san: 'f4',
                                      comment: 'White gains central space and prepares e5 thrust.',
                                      children: [{
                                        san: 'Be7',
                                        comment: 'Breaking the pin and preparing castle.'
                                      }]
                                    }]
                                  }]
                                }
                              ]
                            }]
                          }]
                        }]
                      }]
                    }]
                  }]
                }]
              }]
            }]
          }
        ], START_FEN)
      }
    ]
  },
  {
    name: "The Ruy Lopez: Noah's Ark Trap",
    category: 'Traps',
    difficulty: 'Beginner',
    description: 'Learn how to punish White if they play too greedily in the Ruy Lopez. The Noah\'s Ark trap traps White\'s light-squared bishop using Black\'s queenside pawns.',
    isFavorite: 1,
    tags: ['Trap', 'Tactical', 'Queenside', 'Opening'],
    createdAt: Date.now() - 86400000,
    chapters: [
      {
        id: 'noah-ark',
        name: "Noah's Ark Trap",
        fen: START_FEN,
        moves: compileSimpleMoves([
          {
            san: 'e4',
            children: [{
              san: 'e5',
              children: [{
                san: 'Nf3',
                children: [{
                  san: 'Nc6',
                  children: [{
                    san: 'Bb5',
                    comment: 'Ruy Lopez. Attacking the knight that defends e5.',
                    children: [{
                      san: 'a6',
                      comment: 'Morphy Defense. Questioning the bishop.',
                      children: [{
                        san: 'Ba4',
                        comment: 'White maintains the pressure.',
                        children: [{
                          san: 'd6',
                          comment: 'Steinitz Defense Deferred. Solidifying the e5 pawn.',
                          children: [{
                            san: 'd4',
                            comment: 'White challenges the center.',
                            children: [{
                              san: 'b5',
                              comment: 'Chasing the bishop away first.',
                              children: [{
                                san: 'Bb3',
                                children: [{
                                  san: 'Nxd4',
                                  comment: 'Trading knights in the center.',
                                  children: [{
                                    san: 'Nxd4',
                                    children: [{
                                      san: 'exd4',
                                      children: [
                                        {
                                          san: 'Qxd4??',
                                          comment: 'Blunder! White recaptures greedily, allowing Black to trap the bishop.',
                                          circles: [{ square: 'd4', color: 'red' }],
                                          children: [{
                                            san: 'c5',
                                            comment: 'Attacking the Queen. She must move.',
                                            children: [{
                                              san: 'Qd5',
                                              comment: 'Creating a double threat: mate on f7 and attacking the rook on a8.',
                                              arrows: [{ from: 'd5', to: 'f7', color: 'red' }, { from: 'd5', to: 'a8', color: 'red' }],
                                              children: [{
                                                san: 'Be6',
                                                comment: 'Blocking the mate threat. The rook is safe because the Queen blocks it.',
                                                children: [{
                                                  san: 'Qc6+',
                                                  children: [{
                                                    san: 'Bd7',
                                                    children: [{
                                                      san: 'Qd5',
                                                      children: [{
                                                        san: 'c4!',
                                                        comment: 'The Ark is closed! The bishop on b3 is trapped and cannot escape!',
                                                        circles: [{ square: 'b3', color: 'red' }]
                                                      }]
                                                    }]
                                                  }]
                                                }]
                                              }]
                                            }]
                                          }]
                                        },
                                        {
                                          san: 'c3',
                                          comment: 'Correct! White plays a gambit or avoids the trap.'
                                        }
                                      ]
                                    }]
                                  }]
                                }]
                              }]
                            }]
                          }]
                        }]
                      }]
                    }]
                  }]
                }]
              }]
            }]
          }
        ], START_FEN)
      }
    ]
  },
  {
    name: "Queen's Sacrifice & Smothered Mate",
    category: 'Middlegame',
    difficulty: 'Beginner',
    description: 'Learn the famous smothered mate sequence. By sacrificing the queen on the corner square, you force the opponent\'s own rook to trap their king, allowing the knight to deliver checkmate.',
    isFavorite: 0,
    tags: ['Tactics', 'Mate', 'Sacrifice', 'Knight'],
    createdAt: Date.now() - 172800000,
    chapters: [
      {
        id: 'smothered-mate',
        name: 'Smothered Mate Sequence',
        fen: 'r1b2r1k/pp4pp/2n5/2bQPpN1/2B5/8/PPP3PP/R1B1K2R w KQ - 0 1',
        moves: compileSimpleMoves([
          {
            san: 'Qg8+',
            comment: 'Double exclamation mark! A brilliant queen sacrifice forcing the rook to block the king.',
            arrows: [{ from: 'd5', to: 'g8', color: 'green' }],
            children: [{
              san: 'Rxg8',
              comment: 'Forced. The king has no escape square.',
              children: [{
                san: 'Nf7#',
                comment: 'Checkmate! The king is smothered by its own pieces.',
                circles: [{ square: 'h8', color: 'red' }]
              }]
            }]
          }
        ], 'r1b2r1k/pp4pp/2n5/2bQPpN1/2B5/8/PPP3PP/R1B1K2R w KQ - 0 1')
      }
    ]
  },
  {
    name: 'Building the Bridge: The Lucena Position',
    category: 'Endgames',
    difficulty: 'Advanced',
    description: 'Master the most important rook endgame. The Lucena position is the blueprint for winning when you have a Rook and Pawn on the 7th rank against a lone Rook.',
    isFavorite: 1,
    tags: ['Endgame', 'Rook', 'Lucena', 'Bridge'],
    createdAt: Date.now() - 259200000,
    chapters: [
      {
        id: 'lucena-bridge',
        name: 'The Bridge Building Technique',
        fen: '2K5/3P4/8/5k2/8/8/r7/3R4 w - - 0 1',
        moves: compileSimpleMoves([
          {
            san: 'Rd4!',
            comment: 'The key bridge-building move! Preparing to shield the king on the 4th rank.',
            arrows: [{ from: 'd1', to: 'd4', color: 'green' }],
            children: [{
              san: 'Rc2+',
              comment: 'Black checks to keep the king away.',
              children: [{
                san: 'Kb7',
                comment: 'Stepping aside to promote.',
                children: [{
                  san: 'Rb2+',
                  children: [{
                    san: 'Kc6',
                    children: [{
                      san: 'Rc2+',
                      children: [{
                        san: 'Kb5',
                        children: [{
                          san: 'Rb2+',
                          children: [{
                            san: 'Rb4!',
                            comment: 'Bridge completed! The rook blocks the check, and white will promote the pawn next turn.',
                            arrows: [{ from: 'b4', to: 'b2', color: 'green' }]
                          }]
                        }]
                      }]
                    }]
                  }]
                }]
              }]
            }]
          }
        ], '2K5/3P4/8/5k2/8/8/r7/3R4 w - - 0 1')
      }
    ]
  },
  {
    name: 'Ruy Lopez: Open Variation Main Line',
    category: 'Openings',
    difficulty: 'Beginner',
    description: 'Understand the classical development and positional nuances of the Ruy Lopez, one of the oldest and most thoroughly analyzed chess openings.',
    isFavorite: 0,
    tags: ['Opening', 'Ruy Lopez', 'Positional', 'Spanish'],
    createdAt: Date.now() - 345600000,
    chapters: [
      {
        id: 'ruy-lopez-open',
        name: 'The Classical Main Line',
        fen: START_FEN,
        moves: compileSimpleMoves([
          {
            san: 'e4',
            children: [{
              san: 'e5',
              children: [{
                san: 'Nf3',
                children: [{
                  san: 'Nc6',
                  children: [{
                    san: 'Bb5',
                    children: [{
                      san: 'a6',
                      children: [{
                        san: 'Ba4',
                        children: [{
                          san: 'Nf6',
                          children: [{
                            san: 'O-O',
                            children: [{
                              san: 'Be7',
                              children: [{
                                san: 'Re1',
                                children: [{
                                  san: 'b5',
                                  children: [{
                                    san: 'Bb3',
                                    children: [{
                                      san: 'd6',
                                      comment: 'Black solidifies the center and frees the light-squared bishop.',
                                      children: [{
                                        san: 'c3',
                                        comment: 'White prepares the d4 push and creates a retreat square for the bishop on c2.',
                                        children: [{
                                          san: 'O-O',
                                          children: [{
                                            san: 'h3',
                                            comment: 'Preventing Bg4 pin before playing d4.',
                                            children: [{
                                              san: 'Na5',
                                              comment: 'Chasing the Bb3, preparing c7-c5.',
                                              children: [{
                                                san: 'Bc2',
                                                children: [{
                                                  san: 'c5',
                                                  children: [{
                                                    san: 'd4',
                                                    comment: 'White strikes in the center! The classical starting position of Ruy Lopez Closed Main Line.'
                                                  }]
                                                }]
                                              }]
                                            }]
                                          }]
                                        }]
                                      }]
                                    }]
                                  }]
                                }]
                              }]
                            }]
                          }]
                        }]
                      }]
                    }]
                  }]
                }]
              }]
            }]
          }
        ], START_FEN)
      }
    ]
  }
];

export async function seedDatabaseIfEmpty() {
  const count = await db.lessons.count();
  if (count === 0) {
    console.log('Seeding chess study database with default lessons...');
    for (const lesson of seedLessons) {
      const lessonId = await db.lessons.add(lesson as Lesson);
      // Seed initial progress for each lesson
      await db.progress.add({
        lessonId,
        lastStudiedAt: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        dueDate: Date.now() + 1000 * 60, // Due in 1 minute
        masteryState: 'new',
      });
    }

    // Seed some mock study history for stats
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      await db.history.add({
        date: dateString,
        movesPlayed: Math.floor(Math.random() * 20) + 5,
        correctMoves: Math.floor(Math.random() * 15) + 5,
      });
    }
    console.log('Database seeded successfully.');
  }
}
