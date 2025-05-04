import { expect } from 'chai';
import TableFlow from '../src/tableFlow.js';

describe('Configuration de TableFlow', () => {
    describe('Options valides', () => {
        it('devrait accepter une configuration minimale', () => {
            const table = new TableFlow({
                tableId: 'test-table'
            });
            expect(table).to.be.an.instanceOf(TableFlow);
        });

        it('devrait accepter une configuration complète', () => {
            const table = new TableFlow({
                tableId: 'test-table',
                verbosity: 2,
                debug: true,
                wrapCellsEnabled: true,
                wrapHeadersEnabled: true,
                cellWrapperClass: 'custom-cell-wrapper',
                headerWrapperClass: 'custom-header-wrapper',
                modifiedCellClass: 'custom-modified',
                cache: {
                    strategy: 'lru',
                    maxSize: 1000
                },
                validation: {
                    strictMode: true
                },
                metrics: {
                    enabled: true
                }
            });
            expect(table).to.be.an.instanceOf(TableFlow);
        });
    });

    describe('Options invalides', () => {
        it('devrait rejeter une configuration sans tableId', () => {
            expect(() => {
                new TableFlow({});
            }).to.throw('Le champ tableId est requis');
        });

        it('devrait rejeter une configuration avec un verbosity invalide', () => {
            expect(() => {
                new TableFlow({
                    tableId: 'test-table',
                    verbosity: 5
                });
            }).to.throw('Valeur invalide pour verbosity');
        });

        it('devrait rejeter une configuration avec une stratégie de cache invalide', () => {
            expect(() => {
                new TableFlow({
                    tableId: 'test-table',
                    cache: {
                        strategy: 'invalid'
                    }
                });
            }).to.throw('Stratégie de cache invalide');
        });
    });

    describe('Valeurs par défaut', () => {
        it('devrait utiliser les valeurs par défaut pour les options non spécifiées', () => {
            const table = new TableFlow({
                tableId: 'test-table'
            });
            expect(table.config.get('verbosity')).to.equal(0);
            expect(table.config.get('debug')).to.equal(false);
            expect(table.config.get('wrapCellsEnabled')).to.equal(true);
            expect(table.config.get('wrapHeadersEnabled')).to.equal(true);
        });
    });

    describe('Changements dynamiques', () => {
        it('devrait accepter les changements de configuration valides', () => {
            const table = new TableFlow({
                tableId: 'test-table'
            });
            table.config.set('verbosity', 1);
            expect(table.config.get('verbosity')).to.equal(1);
        });

        it('devrait rejeter les changements de configuration invalides', () => {
            const table = new TableFlow({
                tableId: 'test-table'
            });
            expect(() => {
                table.config.set('verbosity', 5);
            }).to.throw('Valeur invalide pour verbosity');
        });
    });
}); 